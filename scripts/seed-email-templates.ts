/**
 * BM2-F002 · System email-template seed
 *
 * Plants 10 rows in `email_template` (5 categories × en/zh) with
 * `tenantId = NULL` and `type = "system"` so every tenant can reference
 * them through the union RLS policy added in BM2-F001. F006 (outreach
 * page) and F011 (tests) depend on this seed.
 *
 * Idempotency: upsert keyed on `(name, locale)` pair — re-running is a
 * no-op in terms of row count. We query an existing row first because
 * Prisma has no composite-unique index on (name, locale); instead of
 * adding an index just for seeding, we guard the create with a manual
 * lookup inside a transaction.
 *
 * Run: `npm run seed:email-templates`
 *
 * BL-001 learning: scripts loading DB creds from env must import
 * dotenv explicitly — running `npm run seed:email-templates` without a
 * DATABASE_ADMIN_URL env var exported in-shell would otherwise die on
 * "DATABASE_ADMIN_URL must be set". Importing "dotenv/config" at the
 * top loads .env automatically.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@prisma/client";

const connectionString =
  process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_ADMIN_URL (or DATABASE_URL fallback) must be set to run the seed"
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

interface TemplateSeed {
  name: string; // stable key (same for en / zh pair)
  locale: "en" | "zh";
  subject: string;
  body: string;
  variables: Array<{ token: string; description: string; required: boolean }>;
}

// Shared token catalogue used by every template (each one picks a
// subset it actually references; the JSON documents the full menu so
// AI-customisation dialogs can introspect what a marketer can inject).
const VAR_KOL_NAME = {
  token: "{{kol.name}}",
  description: "KOL display name",
  required: true,
};
// {{kol.handle}} is part of the spec's token catalogue but none of
// the 5 seed bodies reference it — it's documented in the spec so
// marketers can add it on the fly via the AI customisation dialog.
const VAR_PRODUCT_NAME = {
  token: "{{product.name}}",
  description: "Product being promoted",
  required: true,
};
const VAR_PRODUCT_CATEGORY = {
  token: "{{product.category}}",
  description: "Product category / genre",
  required: false,
};
const VAR_PRODUCT_USP = {
  token: "{{product.usp}}",
  description: "Product unique selling points (one-liner)",
  required: true,
};
const VAR_MARKETER_NAME = {
  token: "{{marketer.name}}",
  description: "Sender (logged-in marketer)",
  required: true,
};

const TEMPLATES: TemplateSeed[] = [
  // 1 — Initial Outreach / 初次询价
  {
    name: "Initial Outreach",
    locale: "en",
    subject: "Partnering with {{product.name}} — {{kol.name}}",
    body: `Hi {{kol.name}},

I'm {{marketer.name}} from the {{product.name}} team. We're reaching out because your {{product.category}} content consistently gets the mix of gameplay clarity and community energy we want to associate with our launch.

Quick intro: {{product.usp}}.

If this sounds like something your channel would enjoy covering, I'd love to send over a brief, a review code, and our current sponsorship rates so you can decide at your own pace. No pressure either way.

Would a 15-minute call next week work, or should I email everything across so you can scan it first?

Thanks,
{{marketer.name}}`,
    variables: [
      VAR_KOL_NAME,
      VAR_PRODUCT_NAME,
      VAR_PRODUCT_CATEGORY,
      VAR_PRODUCT_USP,
      VAR_MARKETER_NAME,
    ],
  },
  {
    name: "Initial Outreach",
    locale: "zh",
    subject: "{{product.name}} 合作邀约 · 致 {{kol.name}}",
    body: `{{kol.name}} 您好，

我是 {{product.name}} 团队的 {{marketer.name}}。我们长期关注您在 {{product.category}} 赛道的内容，节奏、玩法讲解和粉丝互动都非常契合我们本次上线想要呈现的调性。

简单介绍：{{product.usp}}。

如果您觉得合适，我可以整理一份项目 brief、体验码以及本轮预算区间，您可以自己节奏查看，不合适也没关系。

方便下周花 15 分钟简单沟通一下吗？或者我先把资料发邮件给您看完再约。

期待回复，
{{marketer.name}}`,
    variables: [
      VAR_KOL_NAME,
      VAR_PRODUCT_NAME,
      VAR_PRODUCT_CATEGORY,
      VAR_PRODUCT_USP,
      VAR_MARKETER_NAME,
    ],
  },

  // 2 — Follow-up / 跟进提醒
  {
    name: "Follow-up",
    locale: "en",
    subject: "Quick nudge on {{product.name}}",
    body: `Hi {{kol.name}},

Just circling back on my note about {{product.name}} last week. I know inboxes get busy, so absolutely no worries if the timing's off.

In case it helps: {{product.usp}}, and I'm happy to adjust the deliverables, the timeline, or the commercials so it fits how you usually run sponsored work.

Would it be easier if I grouped everything into a one-page brief? Or if this isn't the right cycle for you, a quick "not right now" is just as helpful — I'll mark it and follow up later.

Thanks,
{{marketer.name}}`,
    variables: [
      VAR_KOL_NAME,
      VAR_PRODUCT_NAME,
      VAR_PRODUCT_USP,
      VAR_MARKETER_NAME,
    ],
  },
  {
    name: "Follow-up",
    locale: "zh",
    subject: "{{product.name}} 合作跟进 · {{kol.name}}",
    body: `{{kol.name}} 您好，

上周给您发过 {{product.name}} 的合作意向，怕您邮件比较多被淹了，所以再跟一下，您没时间看也完全没关系。

小补充：{{product.usp}}。交付形式、时间线、报价都能按您平时接推广的习惯调，不一定要按我那份模板来。

如果方便，我可以重新整理成一页纸 brief 再发一次；或者这个节点您暂时没精力，回我一句"先不接"我也会收好，下一轮再来打扰。

期待回复，
{{marketer.name}}`,
    variables: [
      VAR_KOL_NAME,
      VAR_PRODUCT_NAME,
      VAR_PRODUCT_USP,
      VAR_MARKETER_NAME,
    ],
  },

  // 3 — Partnership Invitation / 签约邀请
  {
    name: "Partnership Invitation",
    locale: "en",
    subject: "Let's make {{product.name}} official, {{kol.name}}",
    body: `Hi {{kol.name}},

Really glad you're up for this. I'm attaching the partnership paperwork for {{product.name}} along with the payment terms we discussed.

Scope recap: one sponsored upload, creative direction stays with you, and we'll slot the kickoff call to brief the creative on {{product.usp}} and answer any open questions.

Next steps:
1. Sign off on the contract at your convenience
2. Reply with your billing details / payment method
3. I'll book the kickoff call and share the brief deck 24h ahead

Looking forward to shipping this together,
{{marketer.name}}`,
    variables: [
      VAR_KOL_NAME,
      VAR_PRODUCT_NAME,
      VAR_PRODUCT_USP,
      VAR_MARKETER_NAME,
    ],
  },
  {
    name: "Partnership Invitation",
    locale: "zh",
    subject: "{{product.name}} 合作确认函 · {{kol.name}}",
    body: `{{kol.name}} 您好，

很高兴确认和您关于 {{product.name}} 的合作。附件是合作合同和我们之前聊过的结算条款。

范围回顾：一条定制推广视频，创意方向由您主导，正式开工前我们会组织一次 brief 会议，围绕 {{product.usp}} 做简要说明，同时回答您剩余的问题。

下一步：
1. 有空时签回合同即可
2. 回我收款信息 / 开票资料
3. 我会在 brief 会前 24h 发议程和资料

期待一起把这条推广做好，
{{marketer.name}}`,
    variables: [
      VAR_KOL_NAME,
      VAR_PRODUCT_NAME,
      VAR_PRODUCT_USP,
      VAR_MARKETER_NAME,
    ],
  },

  // 4 — Polite Decline / 拒绝跟进
  {
    name: "Polite Decline",
    locale: "en",
    subject: "About {{product.name}} this round, {{kol.name}}",
    body: `Hi {{kol.name}},

Thanks again for the detailed reply on {{product.name}} — we really appreciated you taking the time to think it through.

On our side, the lineup for this cycle leaned a bit more toward a different {{product.category}} angle, so we won't be moving forward together right now. The door is very much open for future launches, and I'd like to stay in touch the next time we have something closer to your audience.

If there's a campaign type you'd specifically like us to bring you first, please let me know and I'll tag it on our side.

Wishing you a great quarter,
{{marketer.name}}`,
    variables: [
      VAR_KOL_NAME,
      VAR_PRODUCT_NAME,
      VAR_PRODUCT_CATEGORY,
      VAR_MARKETER_NAME,
    ],
  },
  {
    name: "Polite Decline",
    locale: "zh",
    subject: "关于 {{product.name}} 本轮合作 · {{kol.name}}",
    body: `{{kol.name}} 您好，

再次感谢您认真回复 {{product.name}} 这边的合作意向，也谢谢您花时间把想法整理得这么清楚。

综合考虑这一轮的整体盘面，我们这次选择了另一个更偏 {{product.category}} 方向的合作阵容，所以本次就先不推进了。后续若有更贴合您频道调性的项目，我会第一时间联系您。

如果您希望下一次优先对接某一类型的品牌/产品推广，也请告诉我，我会在这边打个标签。

祝季度顺利，
{{marketer.name}}`,
    variables: [
      VAR_KOL_NAME,
      VAR_PRODUCT_NAME,
      VAR_PRODUCT_CATEGORY,
      VAR_MARKETER_NAME,
    ],
  },

  // 5 — Post-Collab Check-in / 已合作回访
  {
    name: "Post-Collab Check-in",
    locale: "en",
    subject: "Following up after {{product.name}} · {{kol.name}}",
    body: `Hi {{kol.name}},

Now that the {{product.name}} piece has been live for a couple of weeks, I wanted to check in and hear how it felt from your side — brief, timing, communication, anything I could have handled better.

On the numbers side we're genuinely happy with what the upload is doing for the campaign, and the team flagged your delivery as a highlight of this cycle.

We've got another {{product.category}} launch coming up next quarter. Would you be open to early access so you can decide whether a second round makes sense for your channel?

Thanks again for the collaboration,
{{marketer.name}}`,
    variables: [
      VAR_KOL_NAME,
      VAR_PRODUCT_NAME,
      VAR_PRODUCT_CATEGORY,
      VAR_MARKETER_NAME,
    ],
  },
  {
    name: "Post-Collab Check-in",
    locale: "zh",
    subject: "{{product.name}} 合作回访 · {{kol.name}}",
    body: `{{kol.name}} 您好，

{{product.name}} 这条推广上线也有两周了，想跟您聊聊这次合作您的感受 —— brief 是否清晰、节奏是否合适、沟通里有没有我可以做得更好的地方，都欢迎告诉我。

数据这边我们对内容整体表现很满意，团队里也把您这一轮的交付标成了本季度的亮点。

下个季度我们还有一个 {{product.category}} 方向的新项目，想先把资料发给您参考一下，您再判断是否适合做第二轮。

再次感谢这次合作，
{{marketer.name}}`,
    variables: [
      VAR_KOL_NAME,
      VAR_PRODUCT_NAME,
      VAR_PRODUCT_CATEGORY,
      VAR_MARKETER_NAME,
    ],
  },
];

interface SeedStats {
  inserted: number;
  updated: number;
  total: number;
}

async function seedSystemTemplates(): Promise<SeedStats> {
  const stats: SeedStats = { inserted: 0, updated: 0, total: 0 };
  for (const tpl of TEMPLATES) {
    // System templates have tenantId=null, so Prisma's findUnique on a
    // composite "tenantId_name_locale" index won't work. Use findFirst
    // filtered on the (name, locale) pair + tenantId IS NULL.
    const existing = await prisma.emailTemplate.findFirst({
      where: { tenantId: null, name: tpl.name, locale: tpl.locale },
      select: { id: true },
    });
    const emailTemplateData: Prisma.EmailTemplateUncheckedCreateInput = {
      tenantId: null,
      name: tpl.name,
      subject: tpl.subject,
      body: tpl.body,
      variables: tpl.variables,
      locale: tpl.locale,
      type: "system",
    };

    let templateId: string;
    if (existing) {
      await prisma.emailTemplate.update({
        where: { id: existing.id },
        data: emailTemplateData,
      });
      templateId = existing.id;
      stats.updated += 1;
    } else {
      const created = await prisma.emailTemplate.create({
        data: emailTemplateData,
        select: { id: true },
      });
      templateId = created.id;
      stats.inserted += 1;
    }

    // BL-025-F006 dual-write — keep the unified asset table in sync so
    // loadOutreachTemplates (which now reads from `asset` rather than
    // `email_template`) sees these system seeds. id is shared with the
    // email_template row so future email_log.template_id can refer to
    // either source consistently.
    await prisma.asset.upsert({
      where: { id: templateId },
      update: {
        name: tpl.name,
        content: {
          subject: tpl.subject,
          body: tpl.body,
          locale: tpl.locale,
          variables: tpl.variables,
        },
        status: "published",
        source: "system_seed",
      },
      create: {
        id: templateId,
        tenantId: null,
        type: "email",
        name: tpl.name,
        content: {
          subject: tpl.subject,
          body: tpl.body,
          locale: tpl.locale,
          variables: tpl.variables,
        },
        source: "system_seed",
        status: "published",
        metadata: { seeded: true },
      },
    });

    stats.total += 1;
  }
  return stats;
}

async function main() {
  const stats = await seedSystemTemplates();
  console.log("Seed complete:", {
    total_attempted: stats.total,
    inserted: stats.inserted,
    updated: stats.updated,
    expected: TEMPLATES.length, // 10
  });
}

// Named export so prisma/seed.ts can chain-run this seed inside the
// same DB connection if we ever want `prisma db seed` to cover system
// templates too. Also imported by tests/integration/email-template-
// seed.test.ts.
export { seedSystemTemplates, TEMPLATES };

// Only auto-run main() when this file is invoked directly (`tsx
// scripts/seed-email-templates.ts`), not when imported as a module —
// importing-and-auto-seeding would race with test cleanup (cleanDb)
// and spike row counts before specs can assert on them.
//
// import.meta.url => "file:///…/scripts/seed-email-templates.ts"
// process.argv[1] => the file tsx was told to execute.
const invokedDirectly =
  import.meta.url === `file://${process.argv[1]}` ||
  (process.argv[1]?.endsWith("seed-email-templates.ts") ?? false);

if (invokedDirectly) {
  main()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
