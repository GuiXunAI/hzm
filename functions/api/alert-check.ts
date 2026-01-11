export async function onRequestGet(context: any) {
  const { env, request } = context;
  
  const makeResponse = (data: any, status = 200) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache"
      }
    });
  };

  try {
    const url = new URL(request.url);
    const testTo = url.searchParams.get('test_to'); 
    const RESEND_API_KEY = env.RESEND_API_KEY;
    const SENDER_EMAIL = env.RESEND_FROM_EMAIL || "Live Well <onboarding@resend.dev>";
    
    if (!RESEND_API_KEY) return makeResponse({ status: "error", message: "未配置 RESEND_API_KEY" }, 500);

    // --- 1. 快捷测试模式 ---
    if (testTo) {
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({
          from: SENDER_EMAIL,
          to: [testTo],
          subject: "【活着么】系统连通性测试",
          text: `您的自定义域名发信系统 (${SENDER_EMAIL}) 工作正常！`,
        }),
      });
      return makeResponse({ status: "success", result: await resendResponse.json() });
    }

    // --- 2. 正式巡检模式 (48小时协议) ---
    if (!env.DB) return makeResponse({ status: "error", message: "数据库未绑定" }, 500);

    const now = Date.now();
    // 预警阈值：正式设置为 48 小时 (48 * 60 * 60 * 1000)
    const ALERT_THRESHOLD = 48 * 60 * 60 * 1000; 

    // 查询所有超时且已注册的用户及其紧急联系人
    const { results } = await env.DB.prepare(`
      SELECT u.id, u.name as user_name, u.language, c.email as contact_email, u.last_check_in
      FROM users u
      JOIN contacts c ON u.id = c.user_id
      WHERE u.is_registered = 1 
      AND u.last_check_in < ?
      AND (u.last_alert_sent_at IS NULL OR u.last_alert_sent_at < u.last_check_in)
    `).bind(now - ALERT_THRESHOLD).all();

    if (!results || results.length === 0) {
      return makeResponse({ status: "success", message: "巡检完毕：暂无风险用户", timestamp: now });
    }

    const reports = [];
    for (const user of results) {
      const isEn = user.language === 'en';
      const userName = user.user_name || "用户";
      const lastCheckInTime = new Date(user.last_check_in).toLocaleString();
      
      const subject = isEn 
        ? `[URGENT] Safety Alert for ${userName}` 
        : `【紧急预警】请核实${userName}的安全状态`;
      
      const body = isEn
        ? `Hello, this is an automated safety report from the "Live Well" App.\n\nUser [${userName}] has missed their safety check-in for over 48 hours (Last check-in: ${lastCheckInTime}).\n\nPlease try to contact them immediately to ensure their safety.`
        : `您好，这是来自“活着么”App的自动监测报告。\n\n用户 [${userName}] 已超过 48 小时未进行平安打卡（上次打卡时间: ${lastCheckInTime}）。\n\n请立即尝试通过电话、微信或实地走访联系该用户，以确保其人身安全。`;

      const sendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({ from: SENDER_EMAIL, to: [user.contact_email], subject, text: body }),
      });

      if (sendRes.ok) {
        // 更新数据库，记录预警已发送，防止在下次打卡前重复发送
        await env.DB.prepare("UPDATE users SET last_alert_sent_at = ? WHERE id = ?")
          .bind(now, user.id).run();
      }

      reports.push({ user: userName, contact: user.contact_email, success: sendRes.ok });
    }

    return makeResponse({ status: "success", message: `已处理 ${reports.length} 个预警`, details: reports });

  } catch (err: any) {
    return makeResponse({ status: "error", message: err.message }, 500);
  }
}
