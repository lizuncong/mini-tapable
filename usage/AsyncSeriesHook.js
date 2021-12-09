const { AsyncSeriesHook } = require('tapable')



const testhook = new AsyncSeriesHook(['compilation', 'name'])
// const testhook = new MyAsyncSeriesHook(['compilation', 'name'])

testhook.tap('plugin1', (compilation, name) => {
  console.log('plugin1', name)
  compilation.sum = compilation.sum + 1
  const start = new Date().getTime();
  // throw Error('plugin1抛出的error')
  while(new Date().getTime() - start < 5000){}
  return 'hah'; // 返回值没什么意义
})

testhook.tapPromise('plugin2', (compilation, name) => {
  return new Promise((resolve, reject) => {
    console.log('plugin2', name)
    setTimeout(() => {
      console.log('plugin2状态改变')
      resolve('plugin2.success')
      // reject('plugin2.error') //如果调用的是reject，则不会继续走后面的插件，reject的值会被传递给hook.callAsync的回调函数
    }, 2000)
    compilation.sum = compilation.sum + 1
  })
})


testhook.tapAsync('plugin3', (compilation, name,cb) => {
  console.log('plugin3', name, cb)
  compilation.sum = compilation.sum + 4
  setTimeout(() => {
    console.log('plugin3回调')
    cb();
    // cb('plugin3.error', 'plugin3.error2') // 只有第一个参数会传给最终的回调函数
  }, 3000)
})



const compilation = { sum: 0 }
// 第一种方式：通过hook.callAsync调用
// testhook.callAsync(compilation, 'mike', function(...args){
//   console.log('最终回调', args)
// })

// 第二种方式：通过testhook.promise触发插件执行
testhook.promise(compilation, 'name').then(res => {
  console.log('最终回调', res)
}, err => {
  console.log('有错误了。。。', err)
})
console.log('执行完成', compilation)
