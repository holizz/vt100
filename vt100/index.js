'use strict';

var VT100

if (window.Backbone === undefined) {
  var Backbone = require('backbone')
}

if (window._ === undefined) {
  var _ = require('underscore')
}

//////////////////////////////////////////////////////////////////////////////
// VT100

VT100 = Backbone.Model.extend({
  defaults: {
    canvas: null,
    size: {x: 80, y: 24},
    color: {
      background: 'black',
      foreground: 'white',
    },
    font: 'monospace',
    fontSize: 12, // px
    lineHeight: 1.2, // em
  },

  initialize: function(options) {
    this.display = options.display
    delete options.display

    this.set(options)

    // Initialization
    this.screen = new VT100.Screen(this)

    if (_.isUndefined(this.display) || !('draw' in this.display))
      this.display = new VT100.Display(this.get('canvas'))
    this.display.vt100 = this
    this.display.postInit()

    this.screen.reset()
    this.display.reset()
  },

  // Things the user will want to do

  write: function(str) {
    this.screen.writeString(str)
  },

  getString: function() {
    return this.screen.getString()
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

  this.reset()
}

VT100.Screen.codes = [
  {
    re: /^\[2J$/,
    fn: function() {
      this.clear()
    }
  },
  {
    re: /^\[(\d(?:;\d)*)m$/,
    fn: function(m) {
      var thus = this
      _.each(m[1].split(';'), function(a) {
        switch (parseInt(a, 10)) {
        case 0:
          thus.attr = {
            bold: false,
            underscore: false,
            blink: false,
            reverse: false,
          }
          break;
        case 1:
          thus.attr.bold = true
          break;
        case 4:
          thus.attr.underscore = true
          break;
        case 5:
          thus.attr.blink = true
          break;
        case 7:
          thus.attr.reverse = true
          break;
        }
      })
    }
  },
]

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
    this.screen[yy] = this.line()
  }

  this.setCursor(this.cursor.x, this.cursor.y)
}

VT100.Screen.prototype.line = function() {
  var line = []
  for (var xx = 0; xx < this.size.x; xx++) {
    line[xx] = {}
  }
  return line
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
    // Normal
    this.setCursor(this.cursor.x+1, this.cursor.y)

  } else if (this.cursor.y + 1 >= this.size.y) {
    // At x-max/y-max
    this.screen.shift()
    this.screen.push(this.line())
    this.setCursor(0, this.size.y-1)

  } else {
    // At x-max
    this.setCursor(0, this.cursor.y+1)
  }
}

VT100.Screen.prototype.writeString = function(str) {
  for (var i in str) {
    if (str[i] === '\0x1b') {
      this.escape_sequence = ''
      this.escaped = true
    } else if (this.escaped) {
      var thus = this, c, m
      this.escape_sequence += str[i]

      c = _.detect(VT100.Screen.codes,
                   function(c){m = thus.escape_sequence.match(c.re); return m})

      if (!_.isUndefined(c)) {
        c.fn.call(this, m)
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
  this.vt100.bind('change', this.reset, this)
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
  this.vt100.screen.eachChar(function(x, y, data) {
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
    y: this.getHeight(),
  }

  this.setFont()

  this.c.canvas.width = this.metric.x * this.size.x
  this.c.canvas.height = this.metric.y * this.size.y

  this.draw()
}

VT100.Display.prototype.setFont = function() {
  this.font = this.vt100.get('fontSize')+'px/'+this.vt100.get('lineHeight')+'em "'+this.vt100.get('font')+'"'

  this.c.font = this.font
  this.c.fillStyle = this.vt100.get('color').foreground
  this.c.textAlign = 'center'
  this.c.textBaseline = 'top'
}

VT100.Display.prototype.drawChar = function(x, y, chr, cursor) {
  // chr.attr.blink is intentionally ignored

  this.setFont()
  var chrFillStyle = this.c.fillStyle

  if (chr.attr && chr.attr.bold) {
    this.c.font = 'bold '+this.font
  }

  if (cursor || chr.attr && chr.attr.reverse) {
    this.c.fillStyle = this.vt100.get('color').foreground
    this.c.fillRect(x*this.metric.x, y*this.metric.y,
                    this.metric.x, this.metric.y)
    chrFillStyle = this.vt100.get('color').background
  }

  if (chr.attr && chr.attr.underscore) {
    this.c.fillStyle = chrFillStyle
    var width = this.metric.y / 16
    this.c.fillRect(x*this.metric.x, (y+1)*this.metric.y-width,
                    this.metric.x, width)
  }

  if (chr.chr) {
    this.c.fillStyle = chrFillStyle
    this.c.fillText(chr.chr, x*this.metric.x+this.metric.x/2, y*this.metric.y)
  }
}

VT100.Display.prototype.getHeight = function() {
  return this.vt100.get('fontSize') * this.vt100.get('lineHeight')
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
