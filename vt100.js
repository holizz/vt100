var VT100

//////////////////////////////////////////////////////////////////////////////
// VT100

VT100 = function() {
  this.__init__.apply(this, arguments)
}

VT100.prototype.__init__ = function(canvas, options) {
  options = this._merge({
    font: 'monospace',
    size: 12,
    lineHeight: 14,
  }, options)

  // Set things
  this.font = options.size+'px/'+options.lineHeight+'px "'+options.font+'"'
  this.lineHeight = options.lineHeight
  this.color = {
    background: 'black',
    foreground: 'white',
  }
  this.size = {
    x: 80,
    y: 24
  }

  // Initialization
  this.screen = new VT100.Screen(this)
  this.display = new VT100.Display(this, canvas)
  this.screen.resize(this.size.x, this.size.y)

  // Example stuff
  this.screen.clear()
  this.screen.setChar(0, 0, 't')
  this.screen.setChar(1, 0, 'e')
  this.screen.setChar(2, 0, 's')
  this.screen.setChar(3, 0, 't')
  this.screen.setChar(0, 1, 'i')
  this.screen.setChar(1, 1, 'n')
  this.screen.setChar(2, 1, 'g')
  this.screen.setChar(3, 1, '!')
  this.screen.setCursor(3, 1)

  this.loop()
}

// Things the user will want to do

VT100.prototype.write = function(str) {
  this.screen.writeString(str)
  this.draw()
}

// Utility

VT100.prototype._merge = function(obj1, obj2) {
  var obj3 = {}
  for (var attrname in obj1) obj3[attrname] = obj1[attrname]
  for (var attrname in obj2) obj3[attrname] = obj2[attrname]
  return obj3
}

// Core bits

VT100.prototype.loop = function() {
  this.draw()
}

VT100.prototype.draw = function() {
  this.display.draw()
}

//////////////////////////////////////////////////////////////////////////////
// VT100.Display

VT100.Display = function() {
  this.__init__.apply(this, arguments)
}

VT100.Display.prototype.__init__ = function(vt100, canvas) {
  this.vt100 = vt100

  this.size = {
    x: 0,
    y: 0
  }

  this.c = canvas.getContext('2d')
}

VT100.Display.prototype.draw = function() {
  var thus = this

  // Clear
  this.c.fillStyle = this.vt100.color.background
  this.c.fillRect(0,0,this.c.canvas.width,this.c.canvas.height)

  // Draw each char
  this.vt100.screen.eachChar(function(x, y, data) {
    if (data.cursor) {
      thus.drawChar(x, y, data.chr, true)
    } else if (data.chr) {
      thus.drawChar(x, y, data.chr)
    }
  })
}

VT100.Display.prototype.setSize = function(x, y) {
  this.size.x = x
  this.size.y = y

  this.reset()
}

VT100.Display.prototype.reset = function() {
  this.setFont()
  this.metric = {
    x: this.getWidth(),
    y: this.vt100.lineHeight
  }

  this.c.canvas.width = this.metric.x * this.size.x
  this.c.canvas.height = this.metric.y * this.size.y
}

VT100.Display.prototype.setFont = function() {
  this.c.font = this.vt100.font
  this.c.fillStyle = this.vt100.color.foreground
  this.c.textAlign = 'center'
  this.c.textBaseline = 'top'
}

VT100.Display.prototype.drawChar = function(x, y, chr, cursor) {
  if (cursor===undefined) cursor = false

  this.setFont()

  if (cursor) {
    this.c.fillStyle = this.vt100.color.foreground
    this.c.fillRect(x*this.metric.x, y*this.metric.y,
        this.metric.x, this.metric.y)
    this.c.fillStyle = this.vt100.color.background
  }

  if (chr)
    this.c.fillText(chr, x*this.metric.x+this.metric.x/2, y*this.metric.y)
}

VT100.Display.prototype.getWidth = function() {
  this.setFont()
  return this.c.measureText('m').width
}

//////////////////////////////////////////////////////////////////////////////
// VT100.Screen

VT100.Screen = function() {
  this.__init__.apply(this, arguments)
}

VT100.Screen.prototype.__init__ = function(vt100) {
  this.vt100 = vt100
  this.screen = []
  this.size = {
    x: 0,
    y: 0
  }
  this.cursor = {
    x: 0,
    y: 0
  }
}

VT100.Screen.prototype.resize = function(x, y) {
  this.size.x = x
  this.size.y = y

  this.vt100.display.setSize(x, y)

  this.clear()
}

VT100.Screen.prototype.clear = function() {
  this.screen = []

  for (var yy = 0; yy < this.size.y; yy++) {
    this.screen[yy] = []
    for (var xx = 0; xx < this.size.x; xx++) {
      this.screen[yy][xx] = {}
    }
  }

  this.setCursor(0, 0)
}

VT100.Screen.prototype.setChar = function(x, y, chr) {
  this.screen[y][x].chr = chr
}

VT100.Screen.prototype.setCursor = function(x, y) {
  this.screen[this.cursor.y][this.cursor.x].cursor = false
  this.screen[y][x].cursor = true
  this.cursor.x = x
  this.cursor.y = y
}

VT100.Screen.prototype.eachChar = function(fn) {
  for (var xx = 0; xx < this.size.x; xx++)
    for (var yy = 0; yy < this.size.y; yy++)
      fn(xx, yy, this.screen[yy][xx])
}

VT100.Screen.prototype.writeChar = function(chr) {
  this.setChar(this.cursor.x, this.cursor.y, chr)

  if (this.cursor.x < this.size.x) {
    this.setCursor(this.cursor.x+1, this.cursor.y)
  } else{
    this.setCursor(0, this.cursor.y+1)
  }
}

VT100.Screen.prototype.writeString = function(str) {
  for (var i in str) {
    this.writeChar(str[i])
  }
}
