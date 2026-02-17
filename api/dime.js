import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const UserDataSchema = z.object({
  annualIncome: z.number().nonnegative(),
  mortgageBalance: z.number().nonnegative(),
  otherDebts: z.number().nonnegative(),
  dependents: z.number().int().nonnegative(),
  existingInsurance: z.number().nonnegative(),
  name: z.string().optional().default(""),
  householdSize: z.number().int().optional(),
  maritalStatus: z.string().optional(),
  educationSavings: z.number().nonnegative().optional(),
});

const ResultsSchema = z.object({
  debt: z.number(),
  incomeReplacement: z.number(),
  mortgage: z.number(),
  education: z.number(),
  totalNeeded: z.number(),
  gap: z.number(),
});

const AdviceSchema = z.object({
  whatNumbersMean: z.string(),
  priorities: z.array(z.string()).min(3).max(8),
  coverageStrategy: z.array(z.string()).min(3).max(8),
  disclaimer: z.string(),
});

function computeDime(u) {
  const debt = u.otherDebts;
  const incomeReplacement = u.annualIncome * 10;
  const mortgage = u.mortgageBalance;
  const education = u.dependents * 100000;
  const totalNeeded = debt + incomeReplacement + mortgage + education;
  const gap = Math.max(0, totalNeeded - u.existingInsurance);
  return { debt, incomeReplacement, mortgage, education, totalNeeded, gap };
}

function renderAdviceText(a) {
  return [
    `What the numbers mean:\n${a.whatNumbersMean}`,
    `Priorities:\n- ${a.priorities.join("\n- ")}`,
    `Coverage strategy ideas:\n- ${a.coverageStrategy.join("\n- ")}`,
    `Disclaimer:\n${a.disclaimer}`,
  ].join("\n\n");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Basic protection: require an API key header for GPT Action calls
  const expected = process.env.PC_API_KEY;
  if (expected) {
    const got = req.headers["x-api-key"];
    if (!got || got !== expected) return res.status(401).json({ error: "Unauthorized" });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return res.status(500).json({ error: "Missing GEMINI_API_KEY" });

  // Vercel typically parses JSON into req.body; handle string just in case
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch {}
  }

  // Accept either { userData: {...} } or just {...}
  const candidate = body?.userData ?? body;
  const parsed = UserDataSchema.safeParse(candidate);
  if (!parsed.success) return res.status(400).json({ error: "Invalid payload" });

  const userData = parsed.data;
  const results = computeDime(userData);

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const ai = new GoogleGenAI({ apiKey: geminiKey });

  const prompt = `
You are an insurance/financial education assistant for a DIME life insurance planner.
Return ONLY valid JSON matching the provided schema.

Rules:
- Educational only; not financial advice.
- No sensitive data requests (no SSN, DOB, address, medical info).
- Be plain-language, practical, and concise.
- Avoid naming specific insurers or recommending a specific product as "best".

User profile:
- Income: $${userData.annualIncome.toLocaleString()}
- Mortgage: $${userData.mortgageBalance.toLocaleString()}
- Other debts: $${userData.otherDebts.toLocaleString()}
- Dependents: ${userData.dependents}
- Existing life insurance: $${userData.existingInsurance.toLocaleString()}

DIME results:
- Total needed: $${results.totalNeeded.toLocaleString()}
- Gap: $${results.gap.toLocaleString()}
`.trim();

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: 0.4,
        maxOutputTokens: 700,
        responseMimeType: "application/json",
        responseJsonSchema: zodToJsonSchema(AdviceSchema),
      },
    });

    const raw = response?.text?.trim?.() ?? "";
    const adviceJson = AdviceSchema.parse(JSON.parse(raw));

    return res.status(200).json({
      userData,
      results,
      adviceJson,
      advice: renderAdviceText(adviceJson),
    });
  } catch (e) {
    return res.status(500).json({ error: "AI generation failed" });
  }
}
