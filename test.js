const { SyncHook } = require('tapable')
const CALL_DELEGATE = function(...args){
  this.call = this._createCall(); // The function is dynamically generated when it is called for the first time
  return this.call(...args)
}
class MySyncHook{
  constructor(argNames){
    this.argNames = argNames;
    this.tasks = []
    // this._call = CALL_DELEGATE;
    this.call = CALL_DELEGATE;
  }

  tap(plugin, callback){
    // This.call must be reset every time a new plugin is added
    this.call = CALL_DELEGATE;
    this.tasks.push(callback)
  }
  _createCall(){
    const params = this.argNames.join(',');
    return new Function(params, "this.tasks.forEach(task => task(" + params + "))")
  }
  callDirectly(...args){
    this.tasks.forEach(task => task(...args))
  }
}
const hook = new SyncHook(['compilation'])
const myHook = new MySyncHook(['compilation'])

const compilation = { sum: 0 }
const myCompilation = { sum: 0}

for(let i = 0; i < 1000; i++){
  hook.tap("plugin" + i, (compilation) => {
    compilation.sum = compilation.sum + i
  })

  myHook.tap("plugin" + i, (compilation) => {
    compilation.sum = compilation.sum + i
  })
}
const count = 2000;

console.time('tapable')
for(let i = 0; i < count; i++){
  hook.call(compilation)
}
console.timeEnd('tapable')

console.time('my')
for(let i = 0; i < count; i++){
  myHook.call(myCompilation)
}
console.timeEnd('my')


console.time('my-call')
for(let i = 0; i < count; i++){
  myHook.callDirectly(myCompilation)
}
console.timeEnd('my-call')