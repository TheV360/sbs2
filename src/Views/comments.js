'use strict'
// todo: should have some indicator whether the input fields reflect the current search results or have been edited

class CommentsView extends BaseView {
	Early() {
		this.form = new Form({
			fields: [
				['search', 'text', {label: "Search", param: 's'}],
				['pages', 'number_list', {label: "Page Ids", param: 'pid'}],
				['users', 'number_list', {label: "User Ids", param: 'uid'}],
				['start', 'date', {label: "Start Date", param: 'start'}],
				['end', 'date', {label: "End Date", param: 'end'}],
				['range', 'range', {label: "Id Range", param: 'ids'}],
				//todo: combine these 3 into one field type
				// for page + pagesize + direction
				['limit', 'number', {label: "Per Page (200)", param: 'limit'}],
				['page', 'number', {label: "Page (1)", param: 'p'}],
				['reverse', 'checkbox', {label: "Newest First", param: 'r'}],
			],
		})
	}
	Init() {
		this.$form_placeholder.replaceWith(this.form.elem)
		let go = (dir)=>{
			if (!this.location) return
			this.form.read()
			if (dir) {
				// pages are kinda bad now... like, p=0, that's actually p=1, so you press next and go to p=2.. i need to add range limits on the fields etc.
				let p = this.form.inputs.page.value || 1 //rrrr
				if (p+dir<1) {
					if (dir>=0)
						p = 1-dir
					else
						return
				}
				this.form.inputs.page.value = p + dir
			}
			this.location.query = this.form.to_query()
			let pages = this.form.inputs.pages.value
			if (pages && pages.length==1) {
				this.location.id = pages[0]
				delete this.location.query.pid
			} else {
				this.location.id = null
			}
			if (this.location.query.page==0)
				this.location.query.page = "1"
			Nav.goto(this.location, true)
		}
		this.$search_button.onclick = e=>{
			e.preventDefault()
			go()
		}
		this.$html_form.onsubmit = e=>{
			e.preventDefault()
			go()
		}
		this.$prev.onclick = e=>{
			e.preventDefault()
			go(-1)
		}
		this.$next.onclick = e=>{
			e.preventDefault()
			go(+1)
		}
	}
	Start({id, query}) {
		this.form.from_query(query)
		if (id)
			this.form.inputs.pages.value = [id]
		let data = this.form.get()
		let [search, merge] = this.build_search(data)
		this.merge = merge
		
		if (!search)
			return {quick: true}
		
		return {chain: search}
	}
	Render({message:comments, content:pages}) {
		View.set_title("Comments")
		this.form.write()
		this.$results.fill()
		
		if (!comments.length) {
			this.$status.textContent = "(no results)"
		} else {
			this.$status.textContent = "results: "+comments.length
			if (this.merge) {
				let x = document.createElement('message-list')
				this.$results.append(x)
				let list = new MessageList(x, comments[0].contentId) // mmndnhhhgghdhfhdh i sure hope it does (contentId)
				for (let comment of comments)
					list.display_message(comment, false)
			} else {
				for (let c of comments) {
					let parent = pages[~c.contentId]
					this.$results.append(Draw.search_comment(c, parent))
					// todo: maybe have them display in a more compact form without controls by default, and then have a button to render a message list 
					// also, maybe if you load enough comments to reach the adjacent item, it should merge that in,
				}
			}
		}
	}	
	Quick() {
		View.set_title("Comments")
		this.form.write()
		this.$results.fill()
		this.$status.textContent = "(no query)"
	}
	build_search(data) {
		// check if form is empty
		if (!data.search && !(data.users && data.users.length) && !data.range && !data.start && !data.end && !data.page)
			return [null, null]
		
		let values = {}
		let query = []
		let order = 'id'
		
		let merge = true
		
		if (data.reverse) {
			order = 'id_desc'
			merge = false
		}
		let text = data.search
		if (text) {
			values.text = `%${text}%`
			query.push("text LIKE @text")
			merge = false
		}
		if (data.pages) {
			values.pids = data.pages
			query.push("contentId IN @pids")
		}
		if (data.users) { // todo: is an empty list [] or null?
			values.uids = data.users
			query.push("createUserId IN @uids")
			merge = false
		}
		let range = data.range
		if (range) {
			if (range.ids) {
				values.ids = range.ids
				query.push("id IN @ids")
				if (range.ids.length > 1)
					merge = false
			} else {
				if (range.min != null) {
					values.min_id = range.min-1
					query.push("id > @min_id")
				} if (range.max != null) {
					values.max_id = range.max+1
					query.push("id < @max_id")
				}
			}
		}
		if (data.start) {
			values.start = data.start.toISOString()
			query.push("createDate > @start") // should these be ≥/≤?
		}
		if (data.end) {
			values.end = data.end.toISOString()
			query.push("createDate < @end")
		}
		let limit = data.limit || 200 // ugh we need a system for default values or something
		let page = data.page || 1 // 1 indexed
		let skip = (page-1) * limit
		// todo: pages kinda suck, 
		
		return [
			{
				values,
				requests: [
					{type:'message', fields:'*', query:query.join(" AND "), order, limit, skip},
					{type:'content', fields:'name,id,createUserId,permissions', query:"id IN @message.contentId"},
					{type:'user', fields:'*', query:"id IN @message.createUserId OR id IN @content.createUserId"},
				],
			},
			merge,
		]
	}
}
CommentsView.template = HTML`
<view-root>
	<form $=html_form class='nav'>
		<br $=form_placeholder>
		<button $=search_button>🔍Search</button>
		<button $=prev>◀prev</button>
		<button $=next>next▶</button>
		<span $=status></span>
	</form>
	<div $=results></div>
</view-root>
`
View.register('comments', CommentsView)
View.register('chatlogs', {
	Redirect(location) {
		let q = {r: true}
		// we do it this way so the ORDER is preserved :D
		Object.for(location.query, (value, key)=>{
			if (key=='t') key = 's'
			if (key=='s' || key=='pid' || key=='uid')
				q[key] = value
		})
		location.query = q
		// switch to "comments/<id>" url if there is one pid
		location.id = null
		if (q.pid) {
			let pids = CONVERT.number_list.decode(q.pid)
			if (pids && pids.length==1) {
				delete q.pid
				location.id = pids[0]
			}
		}
		location.type = 'comments'
	},
})
