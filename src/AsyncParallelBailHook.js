const { AsyncParallelBailHook } = require('tapable')


/**
 * 特定：
 * 1. 异步并行保险式执行钩子。
 * 2. 通过tap注册的插件，如果返回值不是undefined，则直接执行最终的回调函数，并将返回值传递给最终回调函数的第二个参数，或者testhook.promise的resolve。
 *    如果插件内部报错，则直接执行最终的回调函数，并将错误值传递给最终回调函数的第一个参数，或者testhook.promise的reject
 * 3. 通过tapPromise注册的插件，当调用resolve(value)时，value不是undefined。则执行最终的回调函数，并将value传递给最终回调函数的第二个参数或者
 *    testhook.promise的resolve。当调用reject(err)时，直接执行最终回调函数，并将err传递给最终回调函数的第一个参数，或者testhook.promise的reject
 * 4. 通过testhook.tapAsync(pluginName, (...args,cb) => {})注册的插件。调用cb(err, result)，如果err不是undefined，则直接执行最终的回调函数，
 *    并将err传递给最终回调函数的第一个参数。如果err为undefined，并且result不是undefined，则直接执行最终的回调函数，并将result传给最终回调函数的第二个参数。
 * **/

class MyAsyncParallelBailHook{
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
    const finalCallback = args.pop();
    let count = 0;
    for(let i = 0; i < this.tasks.length; i++){
      const task = this.tasks[i]
      const fn = task.fn;
      if(task.type === 'sync'){
        const res = fn(...args)
        if(res){
          return finalCallback(null, res)
        }

        count++;
        if(count === this.tasks.length){
          finalCallback();
        }
      }
      if(task.type === 'promise'){
        fn(...args).then(res => {
          if(res){
            return finalCallback(null, res)
          }
          count++;
          if(count === this.tasks.length){
            finalCallback();
          }
        }, finalCallback)
      }
      if(task.type === 'async'){
        const cb = (err, result) => {
          count++;
          if(err){
            finalCallback(err)
          } else if(result){
            return finalCallback(null, result)
          }else if(count === this.tasks.length) {
            finalCallback();
          }
        }
        fn(...args, cb)
      }
    }
  }

  promise(...args){
    return new Promise((resolve, reject) => {
      const finalCallback = (err, result) => {
        if(err){
          reject(err)
        } else {
          resolve(result)
        }
      }

      this.callAsync(...args, finalCallback)

    })
  }

}

const testhook = new AsyncParallelBailHook(['compilation', 'name'])
// const testhook = new MyAsyncParallelBailHook(['compilation', 'name'])


/**
 *
 * **/
testhook.tap('plugin1', (compilation, name) => {
  console.log('plugin1', name)
  compilation.sum = compilation.sum + 1
  // throw Error('plugin1.error')
  // return 'plugin1.result';
})

testhook.tapPromise('plugin2', (compilation, name) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      compilation.sum = compilation.sum + 1
      console.log('plugin2', name)
      resolve();
      // resolve('plugin2.result')
      // reject('plugin2.error')
    }, 2000)
  })
})

testhook.tapAsync('plugin3', (compilation, name,cb) => {
  setTimeout(() => {
    compilation.sum = compilation.sum + 4
    console.log('plugin3', name)
    // cb();
    // cb(null, 'plugin3.result'); // 第一个参数用于报告错误，第二个参数用于指示直接执行最终回调函数
    cb('plugin3.error', 'plugin3.result')
  }, 3000)
  // return 'null'
})




const compilation = { sum: 0 }

// 第一种方式：通过hook.callAsync调用
testhook.callAsync(compilation, 'Mike', function(...args){ // 回调函数的参数用于接收错误信息
    console.log('执行完成', compilation)
    console.log('最终回调', ...args)
})

// 第二种方式：通过testhook.promise触发插件执行
// testhook.promise(compilation, 'Mike').then(res => {
//   console.log('最终回调', res) //
// }, err => {
//   console.log('有错误了。。。', err)
// })
console.log('最后的语句', compilation)
