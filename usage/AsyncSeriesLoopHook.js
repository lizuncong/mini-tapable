const { AsyncSeriesLoopHook } = require('tapable')

const testhook = new AsyncSeriesLoopHook(['compilation', 'name'])

let count1 = 2, count2 = 2, count3 = 2

testhook.tap('plugin1', (compilation, name) => {
    console.log('plugin1', count1, name)
    compilation.sum = compilation.sum + 1
})

testhook.tapPromise('plugin2', (compilation, name) => {
    return new Promise((resolve, reject) => {
        console.log('plugin2', count2, name)
        setTimeout(() => {
            if(count2<1){
                resolve()
            } else {
                resolve(count2)
            }
            count2--;
            // reject('plugin2.error')
        }, 1000)
        compilation.sum = compilation.sum + 1
    })
})


testhook.tapAsync('plugin3', (compilation, name,cb) => {
    console.log('plugin3', count3, name)
    compilation.sum = compilation.sum + 4
})



const compilation = { sum: 0 }
// 第一种方式：通过hook.callAsync调用
// testhook.callAsync(compilation, 'mike', function(err){ // 回调函数的参数用于接收错误信息
//     console.log('执行完成', compilation)
//     console.log('最终回调', err)
// })

// 第二种方式：通过testhook.promise触发插件执行
testhook.promise(compilation, 'name').then(res => {
    console.log('最终回调', res) // res永远为undefined
}, err => {
    console.log('有错误了。。。', err)
})
console.log('最后的语句', compilation)
