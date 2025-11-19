// renderer/renderer.js

const { ipcRenderer } = require('electron');
const { KeepLiveWS, toMessageData } = require('tiny-bilibili-ws'); 

let scCount = 0;
let sc_isListEmpty = true;
let liveInstance = null; 

// ... (此处省略 getTimestampConversion 函数) ...
function getTimestampConversion(timestamp) {
    let timeStamp = (timestamp.toString().length === 10) ? timestamp * 1000 : timestamp;
    let date = new Date(timeStamp);
    let h = (date.getHours() < 10 ? '0' + date.getHours() : date.getHours());
    let m = (date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes());
    let s = (date.getSeconds() < 10 ? '0' + date.getSeconds() : date.getSeconds());
    return `${h}:${m}:${s}`; 
}


// ----------------------------------------------------
// 2. SC 脚本核心函数 (UI 渲染)
// ----------------------------------------------------

function $(selector) { return document.querySelector(selector); }
function $$(selector) { return document.querySelectorAll(selector); }

function update_sc_item(sc_data, realtime = true) {
    // 关键修复 1:
    // 我们将确保传入的 sc_data 已经是真正的 SC 数据 (即 data.data.data)
    const data = sc_data; 
    
    if (!data || !data.user_info || !data.user_info.uname) {
        console.warn("尝试渲染SC时发现数据无效:", sc_data);
        return;
    }
    
    // ... (以下代码保持不变) ...
    const content = $('#blive-sc-content');
    if(sc_isListEmpty) {
        content.innerHTML = '';
        sc_isListEmpty = false;
    }

    const sc_background_bottom_color = data.background_bottom_color;
    const sc_background_image = data.background_image;
    const sc_background_color = data.background_color;
    const sc_uid = data.uid;
    const sc_user_info_face = data.user_info.face;
    const sc_user_info_face_frame = data.user_info.face_frame;
    const sc_user_info_uname = data.user_info.uname;
    const sc_price = data.price;
    const sc_message = data.message;
    const sc_start_timestamp = data.start_time;

    let sc_medal_html = '';
    if (data.medal_info && data.medal_info.medal_name) {
        sc_medal_html = `
        <div class="fans_medal_item" style="background-color: ${data.medal_info.medal_color}; border: 1px solid ${data.medal_info.medal_color};">
            <div class="fans_medal_label"><span class="fans_medal_content">${data.medal_info.medal_name}</span></div>
            <div class="fans_medal_level">${data.medal_info.medal_level}</div>
        </div>`;
    }

    const sc_background_image_html = (sc_background_image !== '') ? `background-image: url(${sc_background_image});` : '';
    const sc_font_color = data.user_info.name_color || '#666666';
    const sc_start_time_all = getTimestampConversion(sc_start_timestamp);
    
    let sc_user_info_face_img = `<img src="${sc_user_info_face}" height="40" width="40" style="border-radius: 20px; float: left; position: absolute; z-index:1;">`;
    if (sc_user_info_face_frame !== '') {
        sc_user_info_face_img = `<img src="${sc_user_info_face}" height="35" width="35" style="border-radius: 20px; float: left; position: absolute; z-index: 1;top: 3px;left: 2px;">
                                 <img src="${sc_user_info_face_frame}" height="40" width="40" style="float: left; position: absolute; z-index: 2;">`;
    }
    
    const item = document.createElement('div');
    item.className = `sc_long_item sc_${sc_uid}_${sc_start_timestamp}`;
    item.dataset.fold = "0";
    item.style.cssText = `background-color: ${sc_background_bottom_color}; margin-bottom: 12px; border-radius: 8px 8px 6px 6px; box-shadow: rgba(0, 0, 0, 0.1) 0px 2px 4px; animation: sc_fadenum 0.5s ease forwards;`;
    
    item.innerHTML = `
        <div class="sc_msg_head" style="${sc_background_image_html} height: 40px; background-color: ${sc_background_color}; padding: 5px; background-size: contain; background-repeat: no-repeat; background-position: right center; border-radius: 6px 6px 0px 0px; cursor: pointer;">
            <div class="sc_avatar_div" style="float: left; height: 40px; position: relative; margin-right: 5px;">
                <a href="https://space.bilibili.com/${sc_uid}" target="_blank">${sc_user_info_face_img}</a>
            </div>
            <div class="sc_msg_head_left" style="float: left; height: 40px; margin-left: 45px; padding-top: 2px;">
                <div class="sc_start_time" style="height: 20px; display: flex; align-items: center;">
                    <span class="sc_start_time_all_span" style="color: rgba(0,0,0,0.3); font-size: 10px;">${sc_start_time_all}</span>
                    <span class="sc-read-marker">已阅</span> 
                </div>
                <div class="sc_uname_div" style="height: 20px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; max-width: 150px;">
                    ${sc_medal_html}
                    <span class="sc_font_color" style="color: ${sc_font_color}; font-size: 15px; text-decoration: none;">${sc_user_info_uname}</span>
                </div>
            </div>
            <div class="sc_msg_head_right" style="float: right; height: 40px; padding: 10px 10px 0px 0px;">
                <div class="sc_value_font" style="height: 20px;"><span style="font-size: 18px; float: right; color: #000;">￥${sc_price}</span></div>
            </div>
        </div>
        <div class="sc_msg_body" style="padding: 10px 14px; overflow-wrap: break-word; line-height: 1.6; color: white; font-size: 14px;">
            ${sc_message}
        </div>`;

    content.prepend(item);
    scCount++;
    $('#blive-sc-title').textContent = `醒目留言 (${scCount})`;
}

// ----------------------------------------------------
// 3. WebSocket 连接 (使用 KeepLiveWS)
// ----------------------------------------------------
// renderer.js (在 startSCListener 函数内部)

// 关键修改：从 config.js 文件中导入敏感信息
const config = require('../config.js'); // 注意路径是 '../config.js'

function startSCListener(roomId) {
    console.log(`[Renderer] 正在连接直播间: ${roomId}`);
    $('#blive-sc-title').textContent = `醒目留言 (0) - 尝试连接...`;

    // 使用导入的配置变量
    const USER_COOKIE = config.USER_COOKIE; // ⬅️ 使用配置
    const USER_UID = config.USER_UID;       // ⬅️ 使用配置
    
    liveInstance = new KeepLiveWS(roomId, {
        headers: {
            'Origin': 'https://live.bilibili.com', 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.75 Safari/537.36',
            'Cookie': USER_COOKIE
        },
        uid: USER_UID,
        protover: 3 
    });

    liveInstance.runWhenConnected(() => {
        console.log('[WS] ✅ 认证成功，加入房间。');
        $('#blive-sc-title').textContent = `醒目留言 (${scCount}) - 监听中`;
    });

    liveInstance.on('heartbeat', (online) => {
        console.log(`[WS] 💖 心跳/人气值: ${online}`);
    });

    // 关键修复 2:
    // 修复 SUPER_CHAT_MESSAGE 监听器
    liveInstance.on('SUPER_CHAT_MESSAGE', (data) => {
        
        // 检查 data.data.data 是否存在 (这是真正的 SC 数据)
        if (data && data.data && data.data.data && data.data.data.user_info && data.data.data.price > 0) {
            
            console.log(`[WS] 💰 收到新留言: ￥${data.data.data.price} - ${data.data.data.user_info.uname}`);
            
            // 传递 data.data.data (真正的 SC 数据) 给渲染函数
            update_sc_item(data.data.data); 
            
        } else {
            console.log("[WS] 收到一条非 SC 消息 (如删除或列表更新)，已忽略。", data);
        }
    });

    liveInstance.on('error', (e) => {
        console.error('[WS] 🔴 连接错误:', e);
        $('#blive-sc-title').textContent = `醒目留言 (${scCount}) - 错误`;
    });

    liveInstance.on('close', () => {
        console.log('[WS] ❌ 连接断开');
        $('#blive-sc-title').textContent = `醒目留言 (${scCount}) - 连接断开`;
    });
}

// ----------------------------------------------------
// 4. 应用程序入口
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', function() {
    // 退出按钮事件
    $('#blive-sc-exit').addEventListener('click', function() {
        ipcRenderer.send('close-app');
    });

    // 绑定 SC 卡片点击事件
    document.body.addEventListener('click', function(event) {
        const head = event.target.closest('.sc_msg_head');
        if (head) {
            const $item = head.closest('.sc_long_item');
            const $msg_body = $item.querySelector('.sc_msg_body');

            if ($msg_body.style.display === 'none') {
                $msg_body.style.display = 'block';
            } else {
                $msg_body.style.display = 'none';
            }
            if (!$item.classList.contains('read')) {
                $item.classList.add('read');
            }
        }
    });

    const roomId = ipcRenderer.sendSync('get-room-id');
    console.log(`[Renderer] 成功接收到房间ID: ${roomId}`);
    if (roomId) {
        startSCListener(roomId);
    } else {
        console.error("[Renderer] 房间ID为空。");
        $('#blive-sc-title').textContent = '房间ID未配置';
    }
});