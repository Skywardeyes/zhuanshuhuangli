const cloud = require('wx-server-sdk');
const https = require('https');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// ── DeepSeek API ──

function callDeepSeek(apiKey, messages) {
  return new Promise(function(resolve, reject) {
    var data = JSON.stringify({
      model: 'deepseek-chat',
      messages: messages,
      temperature: 0.7,
      max_tokens: 2048
    });

    var req = https.request({
      hostname: 'api.deepseek.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 60000
    }, function(res) {
      var body = '';
      res.on('data', function(chunk) { body += chunk; });
      res.on('end', function() {
        try {
          var result = JSON.parse(body);
          if (result.choices && result.choices[0] && result.choices[0].message) {
            resolve(result.choices[0].message.content);
          } else if (result.error) {
            reject(new Error(result.error.message || 'API error'));
          } else {
            reject(new Error('Unexpected response: ' + body.substring(0, 200)));
          }
        } catch(e) {
          reject(new Error('Parse error: ' + body.substring(0, 200)));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', function() { req.destroy(); reject(new Error('DeepSeek timeout')); });
    req.write(data);
    req.end();
  });
}

function callDeepSeekWithRetry(apiKey, messages, maxRetries) {
  var retries = maxRetries || 2;
  var delay = 2000;

  return callDeepSeek(apiKey, messages).catch(function(err) {
    if (retries <= 0) throw err;
    console.log('[DeepSeek] retrying, attempts left:', retries, err.message);
    return new Promise(function(resolve, reject) {
      setTimeout(function() {
        callDeepSeekWithRetry(apiKey, messages, retries - 1).then(resolve).catch(reject);
      }, delay);
      delay = delay * 2;
    });
  });
}

// ── Prompt Builders ──

function buildSystemPrompt() {
  return '你是一位精通中国传统命理学的专家，能够结合八字命盘为求测者提供专业的命理分析和建议。' +
    '你深入研习《穷通宝典》《三命通会》《滴天髓》《渊海子平》《子平真诠》等经典典籍。\n\n' +
    '你的分析原则：\n' +
    '1. 以日主为核心，结合四柱干支、十神，分析命主的五行喜忌、格局高低\n' +
    '2. 结合大运流年分析命主当前所处的运势阶段\n' +
    '3. 引用经典理论，但做到深入浅出，先解释命理术语再进行分析\n' +
    '4. 回答要具体实用，避免空泛的套话\n' +
    '5. 命理分析仅供文化娱乐参考，不涉及封建迷信\n' +
    '6. 对于不确定的问题坦诚说明，不要编造\n' +
    '7. 使用中文回答，语气温和、专业，像一位有学问的长者\n' +
    '8. 不给出具体的人生决策建议（如"应该辞职""应该分手"等），只提供命理层面的分析\n' +
    '9. 对于涉及生死、疾病预后等敏感话题，委婉拒绝回答';
}

function formatBaziInfo(bazi, index) {
  var yp = bazi.yearPillar || {};
  var mp = bazi.monthPillar || {};
  var dp = bazi.dayPillar || {};
  var hp = bazi.hourPillar || {};

  var xiyongArr = (bazi.xiyong && bazi.xiyong.xiyong) ? bazi.xiyong.xiyong : [];
  var jishenArr = (bazi.xiyong && bazi.xiyong.jishen) ? bazi.xiyong.jishen : [];

  var currentDayun = getCurrentDayun(bazi.dayun, bazi.birthYear);

  var parts = [];
  parts.push('【命主' + (index + 1) + '：' + (bazi.name || '未命名') + '】');
  parts.push('- 性别：' + (bazi.gender || '未填写'));
  parts.push('- 出生：' + (bazi.birthYear || '?') + '年' + (bazi.birthMonth || '?') + '月' + (bazi.birthDay || '?') + '日 ' + (bazi.birthTime || '?') + '时');
  parts.push('- 出生地：' + (bazi.birthplace || '未填写'));

  var formatCanggan = function(cg) {
    if (!cg || !cg.length) return '无';
    return cg.map(function(x) { return x.gan; }).join('、');
  };

  parts.push('- 四柱八字：');
  parts.push('  年柱：' + (yp.stem||'?') + (yp.branch||'?') + '（十神：' + (yp.shishen||'') + '，藏干：' + formatCanggan(yp.canggan) + '）');
  parts.push('  月柱：' + (mp.stem||'?') + (mp.branch||'?') + '（十神：' + (mp.shishen||'') + '，藏干：' + formatCanggan(mp.canggan) + '）');
  parts.push('  日柱：' + (dp.stem||'?') + (dp.branch||'?') + '（日主，藏干：' + formatCanggan(dp.canggan) + '）');
  parts.push('  时柱：' + (hp.stem||'?') + (hp.branch||'?') + '（十神：' + (hp.shishen||'') + '，藏干：' + formatCanggan(hp.canggan) + '）');

  parts.push('- 日主：' + (bazi.dayMaster || '?'));
  parts.push('- 命局强弱：' + (bazi.strength ? bazi.strength.strength : '?') + '（' + (bazi.strength ? bazi.strength.score : '?') + '分）');
  parts.push('- 格局：' + (bazi.pattern || '?'));

  if (bazi.wuxingCount) {
    var wxParts = [];
    var wxNames = ['金','木','水','火','土'];
    for (var i = 0; i < wxNames.length; i++) {
      if (bazi.wuxingCount[wxNames[i]] !== undefined) {
        wxParts.push(wxNames[i] + ':' + bazi.wuxingCount[wxNames[i]]);
      }
    }
    parts.push('- 五行分布：' + wxParts.join('、'));
  }

  parts.push('- 喜用神：' + (xiyongArr.length > 0 ? xiyongArr.join('、') : '无'));
  parts.push('- 忌神：' + (jishenArr.length > 0 ? jishenArr.join('、') : '无'));

  if (bazi.shensha) {
    var ss = bazi.shensha;
    var ssParts = [];
    if (ss.tianyi && ss.tianyi.length) ssParts.push('天乙贵人：' + ss.tianyi.join('、'));
    if (ss.wenchang) ssParts.push('文昌贵人：' + ss.wenchang);
    if (ss.yima) ssParts.push('驿马：' + ss.yima);
    if (ss.taohua) ssParts.push('桃花：' + ss.taohua);
    if (ss.huagai) ssParts.push('华盖：' + ss.huagai);
    if (ssParts.length > 0) parts.push('- 神煞：' + ssParts.join('，'));
  }

  if (bazi.dayun) {
    parts.push('- 大运：' + (bazi.dayun.direction||'?') + '，' + (bazi.dayun.qiyunAge||0) + '岁起运，当前' + (currentDayun.stem||'?') + (currentDayun.branch||'?') + '运');
  }

  return parts.join('\n');
}

function buildUserPrompt(baziRecords, historyMessages, userContent) {
  var parts = [];

  // 命主信息
  for (var i = 0; i < baziRecords.length; i++) {
    parts.push(formatBaziInfo(baziRecords[i], i));
    parts.push('');
  }

  // 历史对话
  if (historyMessages && historyMessages.length > 0) {
    parts.push('【历史对话】');
    for (var j = 0; j < historyMessages.length; j++) {
      var msg = historyMessages[j];
      if (msg.role === 'user') {
        parts.push('用户：' + msg.content);
      } else {
        parts.push('大师：' + msg.content);
      }
    }
    parts.push('');
  }

  // 当前问题
  parts.push('【当前问题】');
  parts.push(userContent);

  return parts.join('\n');
}

// ── Dayun Helper ──

function getCurrentDayun(dayun, birthYear) {
  if (!dayun || !dayun.dayunList || !dayun.dayunList.length) {
    return { stem: '?', branch: '?' };
  }
  var now = new Date();
  var age = now.getFullYear() - birthYear;
  for (var i = 0; i < dayun.dayunList.length; i++) {
    if (age >= dayun.dayunList[i].ageStart && age <= dayun.dayunList[i].ageEnd) {
      return { stem: dayun.dayunList[i].stem, branch: dayun.dayunList[i].branch };
    }
  }
  var last = dayun.dayunList[dayun.dayunList.length - 1];
  return { stem: last.stem, branch: last.branch };
}

// ── Main ──

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;

    switch (event.type) {

      // ── Conversation CRUD ──

      case 'listConversations': {
        const res = await db.collection('chat_conversations')
          .where({ _openid: openid })
          .orderBy('updatedAt', 'desc')
          .limit(50)
          .get();
        return { success: true, conversations: res.data };
      }

      case 'createConversation': {
        var title = (event.title || '新对话').substring(0, 50);
        var now = new Date();
        const res = await db.collection('chat_conversations').add({
          data: {
            _openid: openid,
            title: title,
            createdAt: now,
            updatedAt: now
          }
        });
        return { success: true, conversation: { _id: res._id, title: title, createdAt: now, updatedAt: now } };
      }

      case 'renameConversation': {
        if (!event.conversationId) return { success: false, errMsg: '缺少对话ID' };
        var title = (event.title || '未命名').substring(0, 50);
        await db.collection('chat_conversations').doc(event.conversationId).update({
          data: { title: title, updatedAt: new Date() }
        });
        return { success: true };
      }

      case 'deleteConversation': {
        if (!event.conversationId) return { success: false, errMsg: '缺少对话ID' };
        // Delete all messages
        await db.collection('chat_messages')
          .where({ conversationId: event.conversationId })
          .remove();
        // Delete conversation
        await db.collection('chat_conversations').doc(event.conversationId).remove();
        return { success: true };
      }

      // ── Messaging ──

      case 'sendMessage': {
        var content = (event.content || '').trim();
        if (!content) return { success: false, errMsg: '请输入问题' };

        var baziIds = event.baziIds || [];
        var conversationId = event.conversationId || '';

        // 1. Load or create conversation
        var conversation;
        if (conversationId) {
          var convRes = await db.collection('chat_conversations').doc(conversationId).get();
          if (!convRes.data) return { success: false, errMsg: '对话不存在' };
          conversation = convRes.data;
        } else {
          var title = content.substring(0, 20);
          var now = new Date();
          var createRes = await db.collection('chat_conversations').add({
            data: {
              _openid: openid,
              title: title,
              createdAt: now,
              updatedAt: now
            }
          });
          conversationId = createRes._id;
          conversation = { _id: conversationId, title: title };
        }

        // 2. Load bazi records
        var baziRecords = [];
        if (baziIds.length > 0) {
          const _ = db.command;
          var baziRes = await db.collection('bazi_records')
            .where({ _openid: openid, _id: _.in(baziIds) })
            .get();
          // Preserve order from baziIds
          var baziMap = {};
          baziRes.data.forEach(function(b) { baziMap[b._id] = b; });
          for (var i = 0; i < baziIds.length; i++) {
            if (baziMap[baziIds[i]]) {
              baziRecords.push(baziMap[baziIds[i]]);
            }
          }
        }
        if (baziRecords.length === 0) {
          return { success: false, errMsg: '请选择至少一个八字' };
        }

        // 3. Load history (last 20 messages = 10 rounds)
        var historyRes = await db.collection('chat_messages')
          .where({ conversationId: conversationId })
          .orderBy('createdAt', 'desc')
          .limit(20)
          .get();
        var historyMessages = historyRes.data.reverse();

        // 4. Build prompt and call DeepSeek
        var messages = [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: buildUserPrompt(baziRecords, historyMessages, content) }
        ];

        var apiKey = process.env.DEEPSEEK_API_KEY || '';
        if (!apiKey) {
          return { success: false, errMsg: '未配置 AI 服务，请在云函数环境变量中设置 DEEPSEEK_API_KEY' };
        }

        var replyContent;
        try {
          replyContent = await callDeepSeekWithRetry(apiKey, messages, 2);
        } catch (err) {
          console.log('[sendMessage] DeepSeek error:', err.message);
          return { success: false, errMsg: 'AI 服务暂时不可用，请稍后重试' };
        }

        // 5. Save both messages
        var now2 = new Date();
        var userMsg = {
          _openid: openid,
          conversationId: conversationId,
          role: 'user',
          content: content,
          baziIds: baziIds,
          createdAt: now2
        };
        var assistantMsg = {
          _openid: openid,
          conversationId: conversationId,
          role: 'assistant',
          content: replyContent,
          baziIds: baziIds,
          createdAt: new Date(now2.getTime() + 1)
        };

        await db.collection('chat_messages').add({ data: userMsg });
        var replyRes = await db.collection('chat_messages').add({ data: assistantMsg });

        // Update conversation timestamp
        await db.collection('chat_conversations').doc(conversationId).update({
          data: { updatedAt: new Date() }
        });

        return {
          success: true,
          conversationId: conversationId,
          title: conversation.title,
          reply: {
            _id: replyRes._id,
            role: 'assistant',
            content: replyContent,
            baziIds: baziIds,
            createdAt: assistantMsg.createdAt
          }
        };
      }

      case 'getMessages': {
        if (!event.conversationId) return { success: false, errMsg: '缺少对话ID' };
        var msgRes = await db.collection('chat_messages')
          .where({ conversationId: event.conversationId })
          .orderBy('createdAt', 'asc')
          .limit(200)
          .get();
        return { success: true, messages: msgRes.data };
      }

      case 'getConversationDetail': {
        if (!event.conversationId) return { success: false, errMsg: '缺少对话ID' };
        var convRes = await db.collection('chat_conversations').doc(event.conversationId).get();
        if (!convRes.data) return { success: false, errMsg: '对话不存在' };
        var msgRes = await db.collection('chat_messages')
          .where({ conversationId: event.conversationId })
          .orderBy('createdAt', 'asc')
          .limit(200)
          .get();
        return { success: true, conversation: convRes.data, messages: msgRes.data };
      }

      default:
        return { success: false, errMsg: '未知操作类型' };
    }
  } catch (err) {
    console.error('[aiChatFunctions][' + (event && event.type) + ']', err);
    return { success: false, errMsg: '服务异常，请稍后重试', errDetail: err.message || String(err) };
  }
};
