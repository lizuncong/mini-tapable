function anonymous(compilation, name) {
  "use strict";
  var _context;
  var _x = this._x;
  return new Promise((function(_resolve, _reject) {
    var _sync = true;
    function _error(_err) {
      if(_sync)
        _resolve(Promise.resolve().then((function() { throw _err; })));
      else
        _reject(_err);
    };
    function _next1() {
      var _fn2 = _x[2];
      _fn2(compilation, name, (function(_err2) {
        if(_err2) {
          _error(_err2);
        } else {
          _resolve();
        }
      }));
    }
    var _fn0 = _x[0];
    var _hasError0 = false;
    try {
      _fn0(compilation, name);
    } catch(_err) {
      _hasError0 = true;
      _error(_err);
    }
    if(!_hasError0) {
      var _fn1 = _x[1];
      var _hasResult1 = false;
      var _promise1 = _fn1(compilation, name);
      if (!_promise1 || !_promise1.then)
        throw new Error('Tap function (tapPromise) did not return promise (returned ' + _promise1 + ')');
      _promise1.then((function(_result1) {
        _hasResult1 = true;
        _next1();
      }), function(_err1) {
        if(_hasResult1) throw _err1;
        _error(_err1);
      });
    }
    _sync = false;
  }));

}