spark.debug = true;
const { WebConfigBuilder, WebConfigTye } = require('./webConfig');

var GConfig = {};

spark.setOwnProperty("telemetry", { WebConfigBuilder, WebConfigTye });

spark.on("event.telemetry.pushconfig", (cObj) => {
    console.log("get", cObj.plname);
    if (GConfig[cObj.plname]) {
        return;
    }
    GConfig[cObj.plname] = cObj.configObj;
});
spark.emit("event.telemetry.ready");

spark.on("event.telemetry.updateconfig_telemetry",(id,changeK,value)=>{
    console.log("触发回调",id,changeK,value);
})


const wbc = new WebConfigBuilder("telemetry");
wbc.addNumber("webPort", 3002,"网页端口");
wbc.addSwitch("allow_global",true,"是否允许外网访问");
wbc.addSwitch("lock_panel",false,"是否锁定面板,锁定后只能提供私聊机器人获取临时密码");
wbc.addChoosing("theme",['白天','夜间'],1,"主题");
spark.emit("event.telemetry.pushconfig",wbc);

const http = require('http');
const { parse } = require('url');
const fs = require('fs').promises;

// 创建HTTP服务器
const server = http.createServer(async (req, res) => {
    const { pathname, query } = parse(req.url);

    // 定义一个中间件来处理请求数据
    async function handleRequest(req, res, next) {
        if (req.method === 'POST') {
            let body = [];
            req.on('data', chunk => body.push(chunk));
            req.on('end', () => {
                body = Buffer.concat(body).toString();
                next(body);
            });
        } else {
            next(null);
        }
    }

    // 检查请求方法
    if (req.method === 'GET') {
        if (pathname === '/') {
            // 重定向到/page/index.html
            res.writeHead(302, { 'Location': '/page/index' });
            res.end();
        } else if (pathname.startsWith('/page/')) {
            // 用户访问/page/xxx时，读取本地的xxx.html文件
            try {
                var pageName = req.url.substring('/page/'.length);
                if (pageName.includes(".html")) {
                    pageName = pageName.replace(".html", "");
                }
                console.log(pageName);
                const filePath = `${__dirname}/web/${pageName}.html`;
                const content = await fs.readFile(filePath, 'utf-8');
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(content);
                console.log("end");
            } catch (e) {
                console.log(e);
            }
        } else if (pathname.startsWith('/api/')) {
            // 处理GET类型的API请求
            handleApiRequest(pathname.substring('/api/'.length), null, req.method, res);
        } else if (pathname.startsWith('/static/')) {
            var fileName = req.url.substring('/static/'.length);
            const filePath = `${__dirname}/static/${fileName}`;
            const content = await fs.readFile(filePath, 'utf-8');
            if (fileName.endsWith(".js")) res.appendHeader("Content-Type", "text/javascript");
            res.end(content);
        }
        
        else {
            // 其他GET请求，返回404页面
            // 这里需要实现404页面的发送逻辑
            // 其他请求，返回404页面，并重定向到/page/index.html
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(await fs.readFile('./pages/404.html', 'utf-8'));
            res.writeHead(302, { 'Location': '/page/index.html' });
            res.end();
        }
    } else if (req.method === 'POST') {
        // 处理POST请求
        handleRequest(req, res, body => {
            if (pathname.startsWith('/api/')) {
                // 处理POST类型的API请求
                handleApiRequest(pathname.substring('/api/'.length), body, req.method, res);
            } else {
                // POST请求到非API路径，返回405 Method Not Allowed
                res.writeHead(405, { 'Content-Type': 'text/plain' });
                res.end('Method Not Allowed');
            }
        });
    } else {
        // 其他HTTP方法，返回405 Method Not Allowed
        res.writeHead(405, { 'Content-Type': 'text/plain' });
        res.end('Method Not Allowed');
    }
});

// 定义处理API请求的函数
function handleApiRequest(apiName, requestBody, method, res) {
    console.log(apiName);

    // 根据不同的请求方法处理API请求
    if (method === 'GET') {
        // 处理GET请求
        var responseContent = {};
        switch (apiName) {
            case "globa_config":
                console.log("1");
                responseContent = {
                    status: 'success',
                    message: `GET request for ${apiName} received.`,
                    data: GConfig
                };
                break;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(responseContent));
    } else if (method === 'POST') {
        // 处理POST请求
        try {
            const parsedBody = requestBody ? JSON.parse(requestBody) : {};
            console.log(parsedBody);
            var  responseContent  = {}
            switch(apiName){
                case "update_global_config":
                    spark.emit("event.telemetry.updateconfig_"+parsedBody.plugin_id,parsedBody.plugin_id,parsedBody.changeK,parsedBody.value);
                    responseContent.code = 0;
                    break;

            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(responseContent));
        } catch (error) {
            // 如果请求体解析出错，返回400 Bad Request
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Invalid JSON payload');
        }
    }
}

server.listen(3002, () => {
    console.log('服务器运行在 http://localhost:3002/');
});


