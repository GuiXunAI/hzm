
export async function onRequestGet(context: any) {
  const { env, request } = context;
  const url = new URL(request.url);
  const testUserId = url.searchParams.get('test_user');
  
  const now = Date.now();
  const ALERT_THRESHOLD = 2 * 60 * 1000;
  const RESEND_API_KEY = env.RESEND_API_KEY;

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "Cloudflare 未配置 RESEND_API_KEY 环境变量" }), { status: 500 });
  }

  try {
    let usersToAlert = [];

    if (testUserId) {
      // 测试模式：直接给指定用户发邮件
      const { results } = await env.DB.prepare(`
        SELECT u.name as user_name, u.language, c.email as contact_email
        FROM users u
        JOIN contacts c ON u.id = c.user_id
        WHERE u.id = ?
      `).bind(testUserId).all();
      usersToAlert = results.map(r => ({ ...r, daysMissed: '2 (测试)' }));
    } else {
      // 正常模式：查询失联用户
      const { results } = await env.DB.prepare(`
        SELECT 
          u.name as user_name, 
          u.last_check_in, 
          u.language,
          c.email as contact_email
        FROM users u
        JOIN contacts c ON u.id = c.user_id
        WHERE u.is_registered = 1 
        AND u.last_check_in < ?
      `).bind(now - ALERT_THRESHOLD).all();
      
      usersToAlert = results.map(u => ({
        ...u,
        daysMissed: Math.floor((now - u.last_check_in) / (60 * 1000))
      }));
    }

    const report = [];

    for (const user of usersToAlert) {
      const isEn = user.language === 'en';
      
      let subject = "";
      let textBody = "";

      if (isEn) {
        subject = `[Safety Alert] Please verify the safety of ${user.user_name} immediately`;
        textBody = `Dear Guardian,\n\n${user.user_name} has missed daily safety check-ins for ${user.daysMissed} consecutive days.\n\nPlease contact them immediately.\n\n— The Live Well Team`;
      } else {
        // 使用用户提供的新中文模板
        subject = `【安全预警】请立即确认${user.user_name}的安全状态`;
        textBody = `尊敬的紧急联系人：

您好！

您收到这封邮件，是因为您的紧急关联人 ${user.user_name}（活着么App关联姓名）已连续 ${user.daysMissed} 天 未在【活着么】App完成每日平安签到。

为保障${user.user_name}的人身安全，恳请您尽快通过以下方式尝试联系TA：

1. 优先拨打${user.user_name}的常用电话（若您留存相关信息）；

2. 联系${user.user_name}的同住亲友、邻居或同事协助核实；

3. 若多次联系无果，且您判断存在安全风险，建议及时联系当地社区居委会、物业或报警处理。

重要说明：

1. 此邮件为系统自动触发，仅作为安全提醒，不代表${user.user_name}已发生实际危险，也可能是TA忘记签到；

2. 若您已确认${user.user_name}安全，可提醒TA尽快登录App完成签到，避免后续重复预警；

3. 如需调整紧急联系人信息或预警规则，可由${user.user_name}登录【活着么】进行设置。

感谢您的配合，愿每一位独居者都能平安顺遂。

——【活着么】官方团队

（此邮件为系统自动发送，无需回复）`;
      }

      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Live Well App <onboarding@resend.dev>",
          to: [user.contact_email],
          subject: subject,
          text: textBody,
        }),
      });

      report.push({
        user: user.user_name,
        email: user.contact_email,
        success: resendResponse.ok
      });
    }

    return new Response(JSON.stringify({ status: "complete", results: report }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
