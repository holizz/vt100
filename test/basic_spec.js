var vt100 = require('../vt100')
var helpers = require('./helpers/all')

describe('VT100 basic functionality', function() {
  it('is the correct size', function() {
    var v = new vt100.VT100({
      size: {x: 4, y: 6},
      display: (new helpers.Display)
    })

    expect(v.getString()).toEqual('    \n    \n    \n    \n    \n    \n')
  })

  it('accepts simple strings', function() {
    var v = new vt100.VT100({
      size: {x: 4, y: 3},
      display: (new helpers.Display)
    })

    expect(v.getString()).toEqual('    \n    \n    \n')
    v.write('Tes')
    expect(v.getString()).toEqual('Tes \n    \n    \n')
    v.write('ting')
    expect(v.getString()).toEqual('Test\ning \n    \n')
  })

  it('shifts the top line off when needed', function() {
    var v = new vt100.VT100({
      size: {x: 2, y: 4},
      display: (new helpers.Display)
    })

    v.write('aabbccd')
    expect(v.getString()).toEqual('aa\nbb\ncc\nd \n')
    v.write('d')
    expect(v.getString()).toEqual('bb\ncc\ndd\n  \n')
  })
})
