const { AsyncParallelBailHook } = require('tapable')


/**
 * 所有的异步钩子均不支持通过hook.call调用
 * 特点：
 *  1.异步并行执行所有的插件回调函数
 *  2.可以通过hook.tap，hook.tapAsync，hook.tapPromise注册插件，通过hook.callAsync，hook.promise触发插件执行
 *  3.hook.callAsync一定要接收一个回调函数，而且这个回调函数必须放在最后面，前面的都是调用hook.callAsync传递的参数
 *  3.允许中断插件回调函数的执行。如果任意一个插件回调函数有返回值(除了undefined)，那么就会提前退出，不会继续执行后面的插件
 * **/


const testhook = new AsyncParallelBailHook(['compilation', 'name'])


/**
 * 通过tap注册插件，callAsync调用
 * **/
testhook.tap('plugin1', (compilation, name, age) => {
  console.log('plugin1', name, age)
  compilation.sum = compilation.sum + 1
  // return null;
})

testhook.tapPromise('plugin2', (compilation, name, age) => {
  return new Promise((resolve, reject) => {
    console.log('plugin2', name, age)
    setTimeout(() => {
      console.log('promise....')
      // resolve('success')
    }, 2000)
    compilation.sum = compilation.sum + 1
  })
})

testhook.tapAsync('plugin4', (compilation, name,cb) => {
  console.log('plugin4', name, cb)
  compilation.sum = compilation.sum + 4
  setTimeout(() => {
    cb('haha')

  }, 3000)
  // return 'null'
})

testhook.tap('plugin3', (compilation) => {
  console.log('plugin3')
  compilation.sum = compilation.sum + 3
})


const compilation = { sum: 0 }

testhook.callAsync(compilation, 'name', function(...args){
  console.log('最终回调', args)
})
console.log('执行完成', compilation)
