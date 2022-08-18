let unique = 1

class UploaderImage {
	constructor() {
		this.img = new Image()
		this.blob = null
		
		this.canvas = null
		
		this.task = null
		this.source = null
		this.width = null
		this.format = null
		this.quality = null
		Object.seal(this)
	}
	// todo: use FinalizationRegistry to detect leaks?
	free() {
		this.blob = null
		this.blob_to_img()
	}
	blob_to_img() {
		if (this.img.src)
			URL.revokeObjectURL(this.img.src)
		this.img.src = this.blob ? URL.createObjectURL(this.blob) : ""
		return this.img.decode()
	}
	// doesn't set this.blob
	canvas_to_blob(task) {
		return new Promise((y,n)=>{
			this.canvas.toBlob(blob=>{
				if (this.task!==task)
					n()
				else {
					this.blob = blob
					blob ? y() : n()
				}
			}, this.format, this.quality)
		})
	}
	source_to_canvas() {
		let {naturalWidth:w, naturalHeight:h} = this.source.img
		let dw = this.width || w
		let dh = Math.round(dw * h / w)
		
		if (!this.canvas)
			this.canvas = document.createElement('canvas')
		this.canvas.width = dw
		this.canvas.height = dh
		
		let c2d = this.canvas.getContext('2d')
		c2d.drawImage(this.source.img, 0, 0, dw, dh)
	}
	cancel() {
		this.task = null
	}
	async update(source, width, format, quality) {
		if (this.task)
			return
		let task = this.task = unique++
		
		try {
			switch (true) {
			default:
				return false
			case source !== this.source:
				this.source = source
				this.free()
				if (!this.source)
					return false
			case width !== this.width:
				this.width = width
				this.blob = null
				this.source_to_canvas()
			case quality !== this.quality:
			case format !== this.format:
				this.quality = quality
				this.format = format
				this.blob = null
				this.blob = await this.canvas_to_blob(task)
				// todo: allow cancelling early (i.e. returning here if a new update is initiated)
				
				await this.blob_to_img()
				if (task!==this.task)
					throw undefined
				return true
			}
		} finally {
			this.task = null
		}
	}
}

class Uploader {
	constructor(f) {
		this.$f = f
		this.in = new UploaderImage()
		this.out = new UploaderImage()
		this.showing = null
		
		// todo: if these change faster than we can encode the img
		// that's REALLY bad, we need to ratelimit this
		this.$f.quality.onchange = ev=>{
			this.encode_canvas(+ev.currentTarget.value, ()=>{
				this.oimg.onload = ev=>{
					this.show_details(this.out)
					// todo: lets just have a single consistent callback
					// and then check whether we should call show_details
				}
			})
		}
		this.$f.resize.onchange = ev=>{
			if (ev.currentTarget.checked) {
				this.update()
			}
		}
		this.$f.scale.onchange = ev=>{
			let v = +ev.currentTarget.value
			this.$f.scale_num.value = v
			this.update_canvas(v)
		}
		this.$f.scale_num.onchange = ev=>{
			let v = +ev.currentTarget.value
			this.$f.scale.value = v
			this.update_canvas(v)
		}
		this.$f.browse.onchange = ev=>{
			let file = ev.currentTarget.files[0]
			ev.currentTarget.value = ""
			if (file)
				this.got_upload(file)
		}
		
		this.in.img.onload = ev=>{
			let w = this.in.img.naturalWidth
			this.$f.scale.value = this.$f.scale.max = w
			this.$f.scale_num.value = this.$f.scale_num.max = w
			this.show_details(this.in)
		}
	}
	update() {
		if (!this.$f.mode.checked)
			return null
		let source = this.in
		let width = +this.$f.scale.value
		let quality = +this.$f.quality.value/100
		let format = quality ? 'image/jpeg' : 'image/png'
		await this.out.update(source, width, format, quality)
		this.show_details(this.out)
	}
	got_upload(file) {
		this.done()
		//f.reset()
		this.$f.resize.checked = false
		this.$f.name.value = file.name
		//f.public.checked
		//f.bucket.value
		this.$f.hash.value = null
		
		this.in.blob = file
		this.blob_to_img(this.in)
	}
	
	show_details(t) {
		if (this.showing !== t)
			return
		
		if (t.img !== this.$image_box.firstChild)
			this.$image_box.replaceChildren(t.img)
		
		let size = t.blob.size
		if (size < 100e3) { // 0-100kb (green - yellow)
			size = (size) / (100e3)
			this.$color.style.backgroundColor = "rgb("+(size*255)+",255,0)"
		} else if (size < 2e6) { // 100kb - 2mb (yellow-red)
			size = (size-100e3) / (2e6-100e3)
			this.$color.style.backgroundColor = "rgb(255,"+((1-size)*255)+",0)"
		} else { // > 2mb (too large)
			this.$color.style.backgroundColor = "magenta"
		}
		
		this.$f.type.value = t.blob.type.replace("image/", "")
		this.$f.size.value = (t.blob.size/1000).toFixed(1)+" kB"
		this.$f.width.value = t.img.naturalWidth
		this.$f.height.value = t.img.naturalHeight
	}
}
