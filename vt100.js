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
  },

  initialize: function(options) {

    this.set(options)

    // Initialization
    if (typeof this.get('screen') === 'undefined' || !('writeString' in this.get('screen')))
      this.set({screen: new VT100.Screen()})
    this.get('screen').vt100 = this

    if (typeof this.get('display') === 'undefined' || !('draw' in options.display))
      this.set({display: new VT100.Display(this.get('canvas'))})
    this.get('display').vt100 = this

    this.get('screen').resize()
    this.get('display').reset()

    this.loop()
  },

  // Things the user will want to do

  write: function(str) {
    this.get('screen').writeString(str)
    this.draw()
  },

  getString: function() {
    return this.get('screen').getString()
  },

  // Core bits

  loop: function() {
    this.draw()
  },

  draw: function() {
    this.get('display').draw()
  },
})

// Utility

VT100._merge = function(obj1, obj2) {
  var obj3 = {}
  for (var attrname in obj1) obj3[attrname] = obj1[attrname]
  for (var attrname in obj2) obj3[attrname] = obj2[attrname]
  return obj3
}

VT100._deepCopy = function(oldObject) {
  var getCloneOfArray = function(oldArray) {
    var tempClone = []

    for (var arrIndex = 0; arrIndex <= oldArray.length; arrIndex++)
      if (typeof(oldArray[arrIndex]) == 'object')
        tempClone.push(this.getCloneOfObject(oldArray[arrIndex]))
      else
        tempClone.push(oldArray[arrIndex])

    return tempClone
  }

  var tempClone = {}

  if (typeof(oldObject) == 'object')
    for (prop in oldObject)
      // for array use private method getCloneOfArray
      if ((typeof(oldObject[prop]) == 'object') &&
          (oldObject[prop]).__isArray)
        tempClone[prop] = this.getCloneOfArray(oldObject[prop])
          // for object make recursive call to getCloneOfObject
      else if (typeof(oldObject[prop]) == 'object')
        tempClone[prop] = this.getCloneOfObject(oldObject[prop])
          // normal (non-object type) members
      else
        tempClone[prop] = oldObject[prop]

  return tempClone
}


//////////////////////////////////////////////////////////////////////////////
// VT100.Screen

VT100.Screen = function() {
  // this.vt100 will be set by VT100 itself

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

  this.codes = {
    '[2J': function() {
      this.clear()
    },
    '[7m': function() {
      this.attr.reverse = true
    }
  }
}

VT100.Screen.prototype.resize = function(x, y) {
  if (x !== undefined && y !== undefined) {
    this.vt100.get('size').x = x
    this.vt100.get('size').y = y
  }

  //TODO: this.vt100.display.resize(this.size.x, this.size.y)

  this.reset()
}

VT100.Screen.prototype.reset = function() {
  this.escape_sequence = ''
  this.escaped = false
  this.screen = []

  this.clear()

  this.setCursor(0, 0)
}

VT100.Screen.prototype.clear = function() {
  for (var yy = 0; yy < this.vt100.get('size').y; yy++) {
    this.screen[yy] = []
    for (var xx = 0; xx < this.vt100.get('size').x; xx++) {
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
}

VT100.Screen.prototype.eachChar = function(fn) {
  for (var xx = 0; xx < this.vt100.get('size').x; xx++)
    for (var yy = 0; yy < this.vt100.get('size').y; yy++)
      fn(xx, yy, this.screen[yy][xx])
}

VT100.Screen.prototype.writeChar = function(chr) {
  this.setChar(this.cursor.x, this.cursor.y, {
    chr: chr,
    attr: VT100._deepCopy(this.attr),
  })

  if (this.cursor.x + 1 < this.vt100.get('size').x) {
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
}

VT100.Screen.prototype.getString = function() {
  var s = ''
  for (var yy = 0; yy < this.vt100.get('size').y; yy++) {
    for (var xx = 0; xx < this.vt100.get('size').x; xx++) {
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
  options = {}
  options = VT100._merge({
    font: 'monospace',
    fontSize: 12,
    lineHeight: 14,
  }, options)

  this.vt100 = options.vt100

  this.font = options.fontSize+'px/'+options.lineHeight+'px "'+options.font+'"'
  this.lineHeight = options.lineHeight

  this.c = canvas.getContext('2d')
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
  this.setFont()
  this.metric = {
    x: this.getWidth(),
    y: this.lineHeight
  }

  this.c.canvas.width = this.metric.x * this.vt100.get('size').x
  this.c.canvas.height = this.metric.y * this.vt100.get('size').y
}

VT100.Display.prototype.setFont = function() {
  this.c.font = this.font
  this.c.fillStyle = this.vt100.get('color').foreground
  this.c.textAlign = 'center'
  this.c.textBaseline = 'top'
}

VT100.Display.prototype.drawChar = function(x, y, chr, cursor) {
  if (typeof chr.attr !== 'object')
    chr.attr = {
      bold: false,
      underscore: false,
      blink: false,
      reverse: false,
    }

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
