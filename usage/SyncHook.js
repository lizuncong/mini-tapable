const { SyncHook } = require('tapable')

const testhook = new SyncHook(['compilation'])
testhook.tap('plugin1', (compilation, name) => {
  console.log('plugin1', name)
  compilation.sum = compilation.sum + 1
})

testhook.tap('plugin2', (compilation, name) => {
  console.log('plugin2..',name)
  compilation.sum = compilation.sum + 2
//   throw Error('抛出一个错误')
  return { name: 'plugin2'}; // 返回值没意义
})

testhook.tap('plugin3', (compilation, name) => {
  console.log('plugin3', compilation, name)
  compilation.sum = compilation.sum + 3
})

const compilation = { sum: 0 }

// 第一种触发方式：通过call触发
// testhook.call(compilation)

// // 第二种触发方式：通过callAsync
// testhook.callAsync(compilation, (...args) => {
//   console.log('最终回调完成..', ...args)
// })
// 第三种触发方式：通过promise
testhook.promise(compilation).then(res => {
    console.log('最终回调...',res)
  }, err => {
    console.log('出错了。。。', err)
  })
  console.log('执行完成', compilation)