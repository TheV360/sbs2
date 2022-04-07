// todo: should have some indicator whether the input fields reflect the current search results or have been edited

View.add_view('comments', {
	form: null,
	
	init() {
		this.form = new Form({
			fields: [
				['search', 'text', {label: "Search", convert: CONVERT.string, param: 's'}],
				['pages', 'number_list', {label: "Page Ids", convert: CONVERT.number_list, param: 'pid'}],
				['users', 'number_list', {label: "User Ids", convert: CONVERT.number_list, param: 'uid'}],
				['start', 'date', {label: "Start Date", convert: CONVERT.date, param: 'start'}],
				['end', 'date', {label: "End Date", convert: CONVERT.date, param: 'end'}],
				['range', 'range', {label: "Id Range", convert: CONVERT.range, param: 'ids'}],
				['reverse', 'checkbox', {label: "Newest First", convert: CONVERT.flag, param: 'r'}],
				['raw', 'checkbox', {label: "Raw Search", convert: CONVERT.flag, param: 'raw'}],
			]
		})
		$commentSearchForm.replaceWith(this.form.elem)
		$commentSearchButton.onclick = ()=>{
			let data = this.form.get()
			let name = "comments"
			if (data.pages && data.pages.length==1) {
				name += "/"+data.pages[0]
				delete data.pages
			}
			let query = this.form.to_query(data)
			Nav.go(name+query)
		}
		View.bind_enter($commentSearch, $commentSearchButton.onclick)
	},
	start(id, query) {
		let data = this.form.from_query(query)
		if (id)
			data.pages = [id]
		let [search, merge] = this.build_search(data)
		
		if (!search)
			return {quick: true, ext: {data}}
		
		return {
			request: {
				values: {},
				requests: [
					
				],
			},
			chains: [
				['comment', search],
				['content.0parentId'],
				['user.0createUserId'],
			],
			ext: {data, merge},
		}
	},
	quick({data}) {
		View.set_title("Comments")
		this.form.set(data)
		$commentSearchResults.fill()
	},
	render(resp, {data, merge}) {
		let comments = resp.comment
		let pages = resp.content
		
		View.set_title("Comments")
		this.form.set(data)
		
		$commentSearchResults.fill()
		if (!comments.length) {
			$commentSearchResults.textContent = "(no result)"
		} else {
			let map = Entity.page_map(pages)
			if (merge) {
				let last_time = 0
				for (let comment of comments) {
					if (comment.deleted)
						continue
					let part = Draw.message_part(comment)
					Draw.insert_comment_merge($commentSearchResults, part, comment, last_time, false)
					last_time = comment.createDate
				}
			} else {
				for (let c of comments) {
					c.parent = map[c.parentId]
					$commentSearchResults.append(Draw.search_comment(c))
					// idea:
					// put all these into a normal comment scroller
					// then add some kind of "history separator" between
					// them, which gets deleted if enough messages are loaded so that the ids overlap
				}
			}
		}
	},
	cleanup() {
		$commentSearchResults.fill()
	},
	
	build_search(data) {
		// check if form is empty
		if (!data.search && !(data.users && data.users.length) && !data.range && !data.start && !data.end)
			return [null, null]
		
		let merge = true
		let search = {limit: 200}
		
		if (data.reverse) {
			search.reverse = true
			merge = false
		}
		let text = data.search
		if (text) {
			if (!data.raw)
				text = "%\n%"+text+"%"
			search.contentLike = text
			merge = false
		}
		if (data.pages)
			search.parentIds = data.pages
		if (data.users) { // todo: is an empty list [] or null?
			search.userIds = data.users
			merge = false
		}
		let range = data.range
		if (range) {
			if (range.ids) {
				search.ids = range.ids
				if (range.ids.length > 1)
					merge = false
			} else {
				if (range.min != null)
					search.minId = range.min-1
				if (range.max != null)
					search.maxId = range.max+1
			}
		}
		if (data.start)
			search.createStart = data.start.toISOString()
		if (data.end)
			search.createEnd = data.end.toISOString()
		
		return [search, merge]
	},
})

View.add_view('chatlogs', {
	redirect: (id, query)=>{
		let q = {r: true}
		// we do it this way so the ORDER is preserved :D
		for (let key in query) {
			if (key=='t')
				q.s = query.t // name changed
			else if (key=='pid')
				q.pid = query.pid
			else if (key=='uid')
				q.uid = query.uid
		}
		// switch to "comments/<id>" url if there is one pid
		id = null
		if (q.pid) {
			let pids = CONVERT.number_list.decode(q.pid)
			if (pids && pids.length==1) {
				delete q.pid
				id = pids[0]
			}
		}
		return ['comments', id, q]
	},
	//TODO: results are links to chatlog viewer which lets you load surrounding messages etc.
	// show page name etc.
})

