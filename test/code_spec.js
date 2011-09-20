var vt100 = require('../vt100')
var helpers = require('./helpers/all')

describe('VT100 control codes', function() {
  it('clears screen', function() {
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
})
