const { AsyncSeriesWaterfallHook } = require('tapable')

/**
 * 特点：
 * 1. 异步串行瀑布式钩子。返回值或者参数会往下一个插件传递
 * 2. 使用tap注册的插件，如果有返回值，则将返回值往下传。如果没有返回值，则将参数往下传
 * 3. 使用tapPromise注册的插件，如果resolve(value)，value不是undefined，则将value往下传。如果value为undefined，则将参数往下传。reject用于报告错误，退出插件执行
 * 4. 使用tapAsync注册的插件，如果调用cb(err, result)，err不是undefined，则退出插件执行，报告错误。如果err为undefined，则将result或者参数往下传
 * 5. 使用callAsync(...args, (err, result) => {})触发插件执行时，err用于接收插件报告的错误，result用于接收插件传递的值
 *6.  使用promise(...args).then(res => {}, err => {})触发插件执行时，res用于接收插件传递的值，err用于接收插件报告的错误
 * **/

class MyAsyncSeriesWaterfallHook{
  constructor(argNames){
    this._argNames = argNames;
    this.tasks = []
  }
  tap(pluginName, task){
    this.tasks.push({
      type: 'sync',
      fn: task,
      pluginName: pluginName
    })
  }
  tapPromise(pluginName, task){
    this.tasks.push({
      type: 'promise',
      fn: task,
      pluginName: pluginName
    })
  }
  tapAsync(pluginName, task){
    this.tasks.push({
      type: 'async',
      fn: task,
      pluginName: pluginName
    })
  }
  callAsync(...args){
    let firstArg = args.shift()
    const finalCallback = args.pop();
    const next = (idx) => {
      if(idx === this.tasks.length){
        finalCallback(null, firstArg)
        return
      }
      const task = this.tasks[idx]
      if(task.type === 'sync'){
        const res = task.fn(firstArg, ...args)
        if(res !== void 0){
          firstArg = res;
        }
        next(idx + 1)
      }
      if(task.type === 'promise'){
        task.fn(firstArg, ...args).then(res => {
          if(res !== void 0){
            firstArg = res
          }
          next(idx + 1)
        }, err => {
          finalCallback(err)
        })
      }

      if(task.type === 'async'){
        const cb = (err, result) => {
          if(err){
            finalCallback(err)
          } else {
            if(result !== void 0){
              firstArg = result
            }
            next(idx + 1)
          }
        }
        task.fn(firstArg, ...args, cb)
      }
    }
    next(0)
  }

  promise(...args){
    return new Promise((resolve, reject) => {
      const finalCallback = (err, result) => {
        if(err){
          reject(err)
        } else {
          resolve(result);
        }
      }
      this.callAsync(...args, finalCallback)
    })
  }
}

// const testhook = new AsyncSeriesWaterfallHook(['compilation', 'name'])
const testhook = new MyAsyncSeriesWaterfallHook(['compilation', 'name'])


testhook.tap('plugin1', (name, compilation) => {
  console.log('plugin1', compilation, name)
  compilation.sum = compilation.sum + 1
  // const start = new Date().getTime();
  // while(new Date().getTime() - start < 2000){}
  // throw Error('plugin1抛出的error')
  return 'plugin1.result'; // 返回值有意义
})

testhook.tapPromise('plugin2', (name, compilation) => {
  return new Promise((resolve, reject) => {
    console.log('plugin2', compilation, name)
    setTimeout(() => {
      resolve();
      // resolve('plugin2.result')
      // reject('plugin2.error')
      compilation.sum = compilation.sum + 1
    }, 1000)
  })
})


testhook.tapAsync('plugin3', (name, compilation,cb) => {
  console.log('plugin3', compilation, name)
  setTimeout(() => {
    compilation.sum = compilation.sum + 4
    // cb();
    // cb(null, 'plugin3.result')
    cb('plugin3.error', 'plugin3.result') // 第一个参数用来报告错误，第二个参数向下传递
  }, 2000)
})



const compilation = { sum: 0 }
// 第一种方式：通过hook.callAsync调用
testhook.callAsync('Mike', compilation, function(err, result){ // 回调函数的参数用于接收错误信息
    console.log('执行完成', compilation)
    console.log('最终回调', err, result)
})

// 第二种方式：通过testhook.promise触发插件执行
// testhook.promise('Mike', compilation).then(res => {
//   console.log('最终回调', res) //
// }, err => {
//   console.log('有错误了。。。', err)
// })
// console.log('最后的语句', compilation)
