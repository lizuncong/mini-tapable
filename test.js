(function anonymous(compilation, _callback
) {
  "use strict";
  var _context;
  var _x = this._x;
  var _results = new Array(4);
  var _checkDone = function() {
    for(var i = 0; i < _results.length; i++) {
      var item = _results[i];
      if(item === undefined) return false;
      if(item.result !== undefined) {
        _callback(null, item.result);
        return true;
      }
      if(item.error) {
        _callback(item.error);
        return true;
      }
    }
    return false;
  }
  do {
    var _counter = 4;
    var _done = (function() {
      _callback();
    });
    if(_counter <= 0) break;
    var _fn0 = _x[0];
    var _hasError0 = false;
    try {
      var _result0 = _fn0(compilation);
    } catch(_err) {
      _hasError0 = true;
      if(_counter > 0) {
        if(0 < _results.length && ((_results.length = 1), (_results[0] = { error: _err }), _checkDone())) {
          _counter = 0;
        } else {
          if(--_counter === 0) _done();
        }
      }
    }
    if(!_hasError0) {
      if(_counter > 0) {
        if(0 < _results.length && (_result0 !== undefined && (_results.length = 1), (_results[0] = { result: _result0 }), _checkDone())) {
          _counter = 0;
        } else {
          if(--_counter === 0) _done();
        }
      }
    }
    if(_counter <= 0) break;
    if(1 >= _results.length) {
      if(--_counter === 0) _done();
    } else {
      var _fn1 = _x[1];
      var _hasResult1 = false;
      var _promise1 = _fn1(compilation);
      if (!_promise1 || !_promise1.then)
        throw new Error('Tap function (tapPromise) did not return promise (returned ' + _promise1 + ')');
      _promise1.then((function(_result1) {
        _hasResult1 = true;
        if(_counter > 0) {
          if(1 < _results.length && (_result1 !== undefined && (_results.length = 2), (_results[1] = { result: _result1 }), _checkDone())) {
            _counter = 0;
          } else {
            if(--_counter === 0) _done();
          }
        }
      }), function(_err1) {
        if(_hasResult1) throw _err1;
        if(_counter > 0) {
          if(1 < _results.length && ((_results.length = 2), (_results[1] = { error: _err1 }), _checkDone())) {
            _counter = 0;
          } else {
            if(--_counter === 0) _done();
          }
        }
      });
    }
    if(_counter <= 0) break;
    if(2 >= _results.length) {
      if(--_counter === 0) _done();
    } else {
      var _fn2 = _x[2];
      _fn2(compilation, (function(_err2, _result2) {
        if(_err2) {
          if(_counter > 0) {
            if(2 < _results.length && ((_results.length = 3), (_results[2] = { error: _err2 }), _checkDone())) {
              _counter = 0;
            } else {
              if(--_counter === 0) _done();
            }
          }
        } else {
          if(_counter > 0) {
            if(2 < _results.length && (_result2 !== undefined && (_results.length = 3), (_results[2] = { result: _result2 }), _checkDone())) {
              _counter = 0;
            } else {
              if(--_counter === 0) _done();
            }
          }
        }
      }));
    }
    if(_counter <= 0) break;
    if(3 >= _results.length) {
      if(--_counter === 0) _done();
    } else {
      var _fn3 = _x[3];
      var _hasError3 = false;
      try {
        var _result3 = _fn3(compilation);
      } catch(_err) {
        _hasError3 = true;
        if(_counter > 0) {
          if(3 < _results.length && ((_results.length = 4), (_results[3] = { error: _err }), _checkDone())) {
            _counter = 0;
          } else {
            if(--_counter === 0) _done();
          }
        }
      }
      if(!_hasError3) {
        if(_counter > 0) {
          if(3 < _results.length && (_result3 !== undefined && (_results.length = 4), (_results[3] = { result: _result3 }), _checkDone())) {
            _counter = 0;
          } else {
            if(--_counter === 0) _done();
          }
        }
      }
    }
  } while(false);

})
