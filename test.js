function anonymous(compilation) {
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
    var _fn0 = _x[0];
    var _hasError0 = false;
    try {
      _fn0(compilation);
    } catch(_err) {
      _hasError0 = true;
      _error(_err);
    }
    if(!_hasError0) {
      var _fn1 = _x[1];
      var _hasError1 = false;
      try {
        _fn1(compilation);
      } catch(_err) {
        _hasError1 = true;
        _error(_err);
      }
      if(!_hasError1) {
        var _fn2 = _x[2];
        var _hasError2 = false;
        try {
          _fn2(compilation);
        } catch(_err) {
          _hasError2 = true;
          _error(_err);
        }
        if(!_hasError2) {
          _resolve();
        }
      }
    }
    _sync = false;
  }));
}
