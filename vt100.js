var VT100

try {
  global.Backbone = require('backbone')
  global._ = require('underscore')
} catch (e) {
}

//////////////////////////////////////////////////////////////////////////////
// VT100

VT100 = Backbone.Model.extend({
  defaults: {
    screen: undefined,
    display: undefined,
    canvas: undefined,
    color: {
      background: 'black',
      foreground: 'white',
    },
    size: {x: 80, y: 24},
    font: 'monospace',
    fontSize: 12,
    lineHeight: 14,
  },

  initialize: function(options) {

    this.set(options)

    // Initialization
    this.set({screen: new VT100.Screen(this)})

    if (_.isUndefined(this.get('display')) || !('draw' in options.display))
      this.set({display: new VT100.Display(this.get('canvas'))})
    this.get('display').vt100 = this
    this.get('display').postInit()

    this.get('screen').reset()
    this.get('display').reset()
  },

  // Things the user will want to do

  write: function(str) {
    this.get('screen').writeString(str)
  },

  getString: function() {
    return this.get('screen').getString()
  },
})


//////////////////////////////////////////////////////////////////////////////
// VT100.Screen

VT100.Screen = function(vt100) {
  this.vt100 = vt100

  this.vt100.bind('change:size', this.reset, this)

  // Changes
  this.screen = []
  this.cursor = {
    x: 0,
    y: 0
  }
  this.attr = {
    bold: false,
    underscore: false,
    blink: false,
    reverse: false,
  }

  // Does not change
  this.codes = {
    '[2J': function() {
      this.clear()
    },
    '[7m': function() {
      this.attr.reverse = true
    }
  }

  this.reset()
}

VT100.Screen.prototype.reset = function() {
  this.size = this.vt100.get('size')

  this.escape_sequence = ''
  this.escaped = false
  this.screen = []

  this.clear()

  this.setCursor(0, 0)

  this.vt100.trigger('screen:reset')
}

VT100.Screen.prototype.clear = function() {
  for (var yy = 0; yy < this.size.y; yy++) {
    this.screen[yy] = []
    for (var xx = 0; xx < this.size.x; xx++) {
      this.screen[yy][xx] = {}
    }
  }

  this.setCursor(this.cursor.x, this.cursor.y)
}

VT100.Screen.prototype.setChar = function(x, y, chr) {
  this.screen[y][x] = chr
}

VT100.Screen.prototype.setCursor = function(x, y) {
  this.screen[this.cursor.y][this.cursor.x].cursor = false
  this.screen[y][x].cursor = true
  this.cursor.x = x
  this.cursor.y = y
  this.vt100.trigger('screen:draw')
}

VT100.Screen.prototype.eachChar = function(fn) {
  for (var xx = 0; xx < this.size.x; xx++)
    for (var yy = 0; yy < this.size.y; yy++)
      fn(xx, yy, this.screen[yy][xx])
}

VT100.Screen.prototype.writeChar = function(chr) {
  this.setChar(this.cursor.x, this.cursor.y, {
    chr: chr,
    attr: _.clone(this.attr),
  })

  if (this.cursor.x + 1 < this.size.x) {
    this.setCursor(this.cursor.x+1, this.cursor.y)
  } else {
    this.setCursor(0, this.cursor.y+1)
  }
}

VT100.Screen.prototype.writeString = function(str) {
  for (var i in str) {
    if (str[i] === '\033') {
      this.escape_sequence = ''
      this.escaped = true
    } else if (this.escaped) {
      this.escape_sequence += str[i]
      if (this.escape_sequence in this.codes) {
        this.codes[this.escape_sequence].apply(this)
        this.escaped = false
      }
    } else {
      this.writeChar(str[i])
    }
  }
  this.vt100.trigger('screen:draw')
}

VT100.Screen.prototype.getString = function() {
  var s = ''
  for (var yy = 0; yy < this.size.y; yy++) {
    for (var xx = 0; xx < this.size.x; xx++) {
      if (this.screen[yy][xx].chr)
        s += this.screen[yy][xx].chr
      else
        s += ' '
    }
    s += '\n'
  }
  return s
}


//////////////////////////////////////////////////////////////////////////////
// VT100.Display

VT100.Display = function(canvas) {
  // this.vt100 will be set by VT100 itself

  this.c = canvas.getContext('2d')
}

VT100.Display.prototype.postInit = function() {
  this.vt100.bind('screen:reset', this.reset, this)
  this.vt100.bind('screen:draw', this.draw, this)
  this.reset()
}

VT100.Display.prototype.draw = function() {
  var thus = this

  // Clear
  this.c.fillStyle = this.vt100.get('color').background
  this.c.fillRect(0,0,this.c.canvas.width,this.c.canvas.height)

  // Draw each char
  this.vt100.get('screen').eachChar(function(x, y, data) {
    if (data.cursor) {
      thus.drawChar(x, y, data, true)
    } else if (data.chr) {
      thus.drawChar(x, y, data)
    }
  })
}

VT100.Display.prototype.reset = function() {
  this.size = this.vt100.get('size')

  this.metric = {
    x: this.getWidth(),
    y: this.vt100.get('lineHeight')
  }

  this.setFont()

  this.c.canvas.width = this.metric.x * this.size.x
  this.c.canvas.height = this.metric.y * this.size.y

  this.draw()
}

VT100.Display.prototype.setFont = function() {
  this.font = this.vt100.get('fontSize')+'px/'+this.vt100.get('lineHeight')+'px "'+this.vt100.get('font')+'"'

  this.c.font = this.font
  this.c.fillStyle = this.vt100.get('color').foreground
  this.c.textAlign = 'center'
  this.c.textBaseline = 'top'
}

VT100.Display.prototype.drawChar = function(x, y, chr, cursor) {
  this.setFont()

  if (cursor || chr.attr.reverse) {
    this.c.fillStyle = this.vt100.get('color').foreground
    this.c.fillRect(x*this.metric.x, y*this.metric.y,
                    this.metric.x, this.metric.y)
    this.c.fillStyle = this.vt100.get('color').background
  }

  if (chr.chr)
    this.c.fillText(chr.chr, x*this.metric.x+this.metric.x/2, y*this.metric.y)
}

VT100.Display.prototype.getWidth = function() {
  this.setFont()
  // The widest character, in case we get given a variable-width font
  return this.c.measureText('m').width
}


//////////////////////////////////////////////////////////////////////////////
// CommonJS export

if (typeof exports !== 'undefined')
  exports.VT100 = VT100
