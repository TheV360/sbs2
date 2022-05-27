// todo: navigate and view could maybe be merged?

Markup.renderer.url_scheme['sbs:'] = function(url) {
	return "#"+url.pathname+url.search+url.hash
}

const Nav = function() { "use strict"; return singleton({
	entity_link(entity) {
		let type = {
			user: 'user',
			content: 'page',
		}[entity.Type]
		if (!type)
			throw new Error('idk entity type')
		return "#"+type+"/"+entity.id
	},
	
	// todo: we should have our own (global) location object or something, rather than passing around urls which are all just the current url anyway
	
	get_location() {
		return new SbsLocation(window.location.hash.substr(1))
	},
	
	// replace = modify address bar without calling render()
	replace_location(location, push) {
		let url = location.toString()
		window.history[push?"pushState":"replaceState"](null, "", "#"+url)
	},
	
	reload: RELOAD,
	
	update_from_location() {
		let location = Nav.get_location()
		Nav.goto(location)
	},
	
	goto(location, push) {
		//console.info("location:", location)
		Nav.replace_location(location, push)
		View.handle_view(location, ()=>{
			//
		}, (e)=>{
			alert("unhandled error while loading page!\n"+e)
			console.error(e)
		})
	},
	
	init() {
		window.onhashchange = ()=>{
			Nav.update_from_location()
		}
		// onclick fires like 20ms before hashchange..
		document.addEventListener('click', event=>{
			let link = event.target.closest('a[href]')
			if (link) {
				let href = link.getAttribute('href')
				if (href.startsWith("#")) {
					event.preventDefault()
					let location = new SbsLocation(href.substr(1))
					Nav.goto(location, true)
				}
			}
		})
		// TODO: what happens if a user clicks a link before Nav.init()?
		
		// send users at ?page/123 to #page/123
		if (window.location.hash=="" && window.location.search.length>1) {
			let x = new URL(window.location)
			x.hash = "#"+x.search.substr(1)
			x.search = ""
			window.history.replaceState(null, "", x.href)
		}
		
		Nav.update_from_location()
	},
}) }()

// notes:
/*
- hashchange fires only when the hash CHANGES, not necessarily when window.location.hash is set, or when a link is clicked
- hashchange does NOT fire if the hash is changed by history.replaceState

*/
