'use strict'
let Act

class ActivityItem {
	constructor(content) {
		this.content = content
		this.users = {}
		this.date = "0"
		this.elem = this.constructor.HTML()
		this.user_elem = this.elem.lastChild.lastChild
		this.page_elem = this.elem.firstChild
		this.time_elem = this.elem.lastChild.firstChild
		this.redraw_page()
		this.top()
	}
	redraw_page() {
		this.elem.href = Nav.entity_link(this.content)
		this.page_elem.fill(Draw.content_label(this.content))
	}
	top() {
		let first = Act.container.firstElementChild
		if (first == this.elem)
			return
		Act.container.prepend(this.elem)
		if (Act.container.contains(document.activeElement))
			return
		let hole = Act.container.querySelector(`:scope > [tabindex="0"]`)
		if (hole)
			hole.tabIndex = -1
		this.elem.tabIndex = 0
	}
	redraw_time() {
		this.time_elem.textContent = Draw.time_ago_string(this.date)
	}
	update_date(date) {
		if (date > this.date) {
			this.date = date
			this.time_elem.title = this.date.toString()
			this.time_elem.setAttribute('datetime', this.date.toISOString())
			this.redraw_time()
			this.top()
		}
	}
	update_content(content) {
		if (content.lastRevisionId > this.content.lastRevisionId) {
			this.content = content
			this.redraw_page()
		}
	}
	update_user(uid, user, date) {
		// hmm user is almost identical to ActivityItem. could reuse class for both?
		if (!user) {
			//console.warn('update user uid?', uid)
			return
		}
		let u = this.users[uid] || (this.users[uid] = {user, date:"0", elem: Draw.link_avatar(user)})
		// todo: show user dates on hover?
		if (date > u.date) { // todo: update user object. why don't users have editDate...
			if (u.date=="0" || u.elem.previousSibling) // hack
				this.user_elem.prepend(u.elem)
			u.date = date
		}
	}
}
ActivityItem.get = function(map, id, content, date) {
	let item = map[id] || (map[id] = new this(content))
	item.update_content(content)
	item.update_date(date)
	return item
}
ActivityItem.handle = function(map, pid, content, uid, user, date) {
	let item = this.get(map, pid, content[~pid], date)
	item.update_user(uid, user[~uid], date)
}
ActivityItem.HTML = 𐀶`
<a class='activity-page' role=row tabindex=-1>
	<div class='bar rem1-5 ellipsis'></div>
	<div class='bar rem1-5 activity-page-bottom ROW'>
		<time class='time-ago ellipsis'></time>
		<activity-users aria-orientation=horizontal class='FILL'>
`

// make a class for activity list
// render new page block only when page added to list
// handle updating existing page blocks (updating users list, time, etc.)
// use this for activity and watchlist
Act = singleton({
	// this is a list of activity items
	// i.e. pages with recent activity, displayed in the sidebar
	items: {},
	
	container: document.createElement('scroll-inner'),
	// TODO: when focus is outside the activity list, only the container itself will have tabindex 0
	// then, when this is focused, it will redirect focus to the first page, and set its own tabindex to -1
	// when focus exits the list, the container's tabindex is set back to 0.
	
	pull_recent() {
		let start = new Date()
		start.setDate(start.getDate() - 1)
		Lp.chain({
			values: {
				yesterday: start,
			},
			requests: [
				{type:'message_aggregate', fields:'contentId, createUserId, maxCreateDate, maxId', query:"createDate > @yesterday"},
				{type:'message', fields:'*', query:"!notdeleted()", order:'id_desc', limit:50},
				{type:'content', fields:'name, id, permissions, contentType, lastRevisionId', query:"id IN @message_aggregate.contentId OR id IN @message.contentId"},
				{type:'user', fields:'*', query:"id IN @message_aggregate.createUserId OR id IN @message.createUserId"},
				// todo: activity_aggregate
			],
		}, (objects)=>{
			console.log('🌄 got initial activity')
			Entity.ascending(objects.message, 'id')
			Sidebar.display_messages(objects.message, true) // TODO: ensure that these are displayed BEFORE any websocket new messages
			
			objects.message_aggregate.sort((a, b)=>a.maxId-b.maxId)
			for (let x of objects.message_aggregate)
				this.message_aggregate(x, objects)
		})
	},
	
	init() {
		this.container.setAttribute('role', 'treegrid')
		do_when_ready(()=>{
			$sidebarActivity.fill(this.container)
			this.refresh_time_interval()
		})
	},
	
	interval: null,
	refresh_time_interval() {
		if (this.interval)
			window.clearInterval(this.interval)
		this.interval = window.setInterval(()=>{
			for (let item of Object.values(this.items))
				item.redraw_time()
		}, 1000*30)
	},
	
	message_aggregate(
		{contentId:pid, createUserId:uid, maxCreateDate2:date},
		{content, user}
	) {
		ActivityItem.handle(this.items, pid, content, uid, user, date)
	},
	
	message(
		{contentId:pid, createUserId:uid, createDate2:date, deleted},
		{content, user}
	) {
		if (deleted) return // mmnn
		ActivityItem.handle(this.items, pid, content, uid, user, date)
	},
	
})

Act.init()
