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
    const targetUserId = url.searchParams.get('user_id');
    const testTo = url.searchParams.get('test_to'); 
    
    // 获取当前环境中的所有 Key，用于排查变量是否注入成功
    const detectedEnvKeys = Object.keys(env);
    
    const RESEND_API_KEY = env.RESEND_API_KEY;
    const SENDER_EMAIL = env.RESEND_FROM_EMAIL || "Live Well <onboarding@resend.dev>";
    const isCustomDomain = !!env.RESEND_FROM_EMAIL;

    if (!RESEND_API_KEY) {
      return makeResponse({ 
        status: "error", 
        message: "未配置 RESEND_API_KEY", 
        detected_keys: detectedEnvKeys 
      }, 500);
    }

    // 域名发信自由度测试模式
    if (testTo) {
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: SENDER_EMAIL,
          to: [testTo],
          subject: "【活着么】域名发信验证成功",
          text: `恭喜！域名发信配置已完全生效。\n\n当前发件人: ${SENDER_EMAIL}\n识别状态: ${isCustomDomain ? '✅ 已识别环境变量' : '⚠️ 未识别变量(使用默认)'}\n检测到的环境参数: ${detectedEnvKeys.join(', ')}`,
        }),
      });
      const resendData: any = await resendResponse.json();
      return makeResponse({ 
        status: resendResponse.ok ? "success" : "failed", 
        mode: "DirectTest", 
        is_custom_domain: isCustomDomain,
        sender_used: SENDER_EMAIL,
        detected_keys: detectedEnvKeys,
        result: resendData 
      });
    }

    // 正常的预警逻辑
    if (!env.DB) return makeResponse({ status: "error", message: "数据库未绑定" }, 500);

    let usersToAlert = [];
    if (targetUserId) {
      const query = await env.DB.prepare(`
        SELECT u.id as user_id, u.name as user_name, u.language, c.email as contact_email, u.last_check_in
        FROM users u
        LEFT JOIN contacts c ON u.id = c.user_id
        WHERE u.id = ?
      `).bind(targetUserId).all();
      usersToAlert = query.results || [];
    } else {
      const now = Date.now();
      const ALERT_THRESHOLD = 2 * 60 * 1000; 
      const query = await env.DB.prepare(`
        SELECT u.id as user_id, u.name as user_name, u.last_check_in, u.language, c.email as contact_email
        FROM users u
        JOIN contacts c ON u.id = c.user_id
        WHERE u.is_registered = 1 AND u.last_check_in < ?
        ORDER BY u.last_check_in DESC LIMIT 5
      `).bind(now - ALERT_THRESHOLD).all();
      usersToAlert = query.results || [];
    }

    const report = [];
    for (const user of usersToAlert) {
      if (!user.contact_email) continue;
      const isEn = user.language === 'en';
      const subject = isEn ? `[Safety Alert] ${user.user_name}` : `【安全预警】请确认${user.user_name}的状态`;
      const textBody = `您好，这是来自“活着么”App的自动预警。\n用户：${user.user_name}\n状态：已超过预定时间未签到。\n请尽快核实其安全。`;

      try {
        const resendResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: SENDER_EMAIL,
            to: [user.contact_email],
            subject: subject,
            text: textBody,
          }),
        });
        const resendData: any = await resendResponse.json();
        report.push({
          user_name: user.user_name,
          success: resendResponse.ok,
          sender_used: SENDER_EMAIL,
          is_custom_domain: isCustomDomain,
          debug: resendData
        });
      } catch (err: any) {
        report.push({ user_name: user.user_name, success: false, error: err.message });
      }
    }

    return makeResponse({ status: "success", report, detected_keys: detectedEnvKeys });

  } catch (err: any) {
    return makeResponse({ status: "error", message: err.message }, 500);
  }
}
