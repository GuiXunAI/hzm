export async function onRequestGet(context: any) {
  const { env } = context;
  
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
    const RESEND_API_KEY = env.RESEND_API_KEY;
    const SENDER_EMAIL = env.RESEND_FROM_EMAIL || "Live Well <onboarding@resend.dev>";
    
    if (!RESEND_API_KEY) return makeResponse({ status: "error", message: "未配置 RESEND_API_KEY" }, 500);
    if (!env.DB) return makeResponse({ status: "error", message: "数据库未绑定" }, 500);

    const now = Date.now();
    const ALERT_THRESHOLD = 48 * 60 * 60 * 1000; 

    const { results } = await env.DB.prepare(`
      SELECT u.id, u.name as user_name, u.language, c.email as contact_email, u.last_check_in
      FROM users u
      JOIN contacts c ON u.id = c.user_id
      WHERE u.is_registered = 1 
      AND u.last_check_in < ?
      AND (u.last_alert_sent_at IS NULL OR u.last_alert_sent_at < u.last_check_in)
    `).bind(now - ALERT_THRESHOLD).all();

    if (!results || results.length === 0) {
      return makeResponse({ status: "success", message: "巡检完毕：暂无新增风险用户", timestamp: now });
    }

    const reports = [];
    for (const user of results) {
      const isEn = user.language === 'en';
      const userName = user.user_name || "用户";
      const hoursMissed = (now - user.last_check_in) / (60 * 60 * 1000);
      const daysMissed = Math.floor(hoursMissed / 24);
      
      let subject = "";
      let textBody = "";

      if (isEn) {
        subject = `[Safety Alert] Please verify the safety of ${userName} immediately`;
        textBody = `Dear Emergency Contact,\n\nYou are receiving this email because your emergency contact ${userName} (Live Well App) has missed daily safety check-ins for ${daysMissed} consecutive days.\n\nPlease contact them immediately to ensure their safety.\n\n— The Live Well Team`;
      } else {
        subject = `【安全预警】请立即确认${userName}的安全状态`;
        textBody = `尊敬的紧急联系人：

您好！

您收到这封邮件，是因为您的紧急关联人 ${userName}（活着么App关联姓名）已连续 ${daysMissed} 天未在【活着么】App完成每日平安签到。

为保障${userName}的人身安全，恳请您尽快通过以下方式尝试联系TA：

1. 优先拨打${userName}的常用电话（若您留存相关信息）；

2. 联系${userName}的同住亲友、邻居或同事协助核实；

3. 若多次联系无果，且您判断存在安全风险，建议及时联系当地社区居委会、物业或报警处理。

重要说明：

1. 此邮件为系统自动触发，仅作为安全提醒，不代表${userName}已发生实际危险，也可能是TA忘记签到；

2. 若您已确认${userName}安全，可提醒TA尽快登录App完成签到，避免后续重复预警；

3. 如需调整紧急联系人信息或预警规则，可由${userName}登录【活着么】进行设置。

感谢您的配合，愿每一位独居者都能平安顺遂。

—— 【活着么】官方团队

（此邮件为系统自动发送，无需回复）`;
      }

      const sendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "Authorization": `Bearer ${RESEND_API_KEY}` 
        },
        body: JSON.stringify({ 
          from: SENDER_EMAIL, 
          to: [user.contact_email], 
          subject, 
          text: textBody 
        }),
      });

      if (sendRes.ok) {
        await env.DB.prepare("UPDATE users SET last_alert_sent_at = ? WHERE id = ?")
          .bind(now, user.id).run();
      }

      reports.push({ user: userName, contact: user.contact_email, success: sendRes.ok });
    }

    return makeResponse({ 
      status: "success", 
      processed_count: reports.length,
      details: reports 
    });

  } catch (err: any) {
    return makeResponse({ status: "error", message: err.message }, 500);
  }
}
