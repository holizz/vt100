var vt100 = require('../vt100')
var helpers = require('./helpers/all')

describe('VT100 control codes', function() {
  it('clears screen (ED)', function() {
    var v = new vt100.VT100({
      size: {x: 4, y: 3},
      display: (new helpers.Display)
    })

    expect(v.getString()).toEqual('    \n    \n    \n')
    v.write('Testing')
    expect(v.getString()).toEqual('Test\ning \n    \n')
    v.write('\033[2J') // Entire screen
    expect(v.getString()).toEqual('    \n    \n    \n')
    v.write('Hi')
    expect(v.getString()).toEqual('    \n   H\ni   \n')
    v.write('\033[2JHo') // Entire screen
    expect(v.getString()).toEqual('    \n    \n Ho \n')
  })

  it('uses char attrs (SGR)', function() {
    var v = new vt100.VT100({
      size: {x: 4, y: 3},
      display: (new helpers.Display)
    })

    // Normal, reverse, reverse and bold
    v.write('T\033[7me\033[1ms')
    expect(v.getString()).toEqual('Tes \n    \n    \n')
    expect(v.screen.screen[0][0].attr.reverse).toEqual(false)
    expect(v.screen.screen[0][1].attr.reverse).toEqual(true)
    expect(v.screen.screen[0][2].attr.reverse).toEqual(true)

    expect(v.screen.screen[0][0].attr.bold).toEqual(false)
    expect(v.screen.screen[0][1].attr.bold).toEqual(false)
    expect(v.screen.screen[0][2].attr.bold).toEqual(true)

    v.screen.reset()
    // Reverse and bold
    v.write('\033[7;1mx')
    expect(v.getString()).toEqual('x   \n    \n    \n')
    expect(v.screen.screen[0][0].attr.reverse).toEqual(true)
    expect(v.screen.screen[0][0].attr.bold).toEqual(true)

    v.screen.reset()
    // Reverse and bold, noattr
    v.write('\033[7;1mx\033[0my')
    expect(v.getString()).toEqual('xy  \n    \n    \n')
    expect(v.screen.screen[0][0].attr.reverse).toEqual(true)
    expect(v.screen.screen[0][0].attr.bold).toEqual(true)
    expect(v.screen.screen[0][1].attr.reverse).toEqual(false)
    expect(v.screen.screen[0][1].attr.bold).toEqual(false)
  })
})
