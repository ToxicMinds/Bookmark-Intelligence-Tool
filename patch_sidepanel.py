with open("src/sidepanel.tsx", "r") as f:
    code = f.read()

# 1. Fix the needsContext logic
code = code.replace(
    "const needsContext = q.toLowerCase().includes('page') || q.toLowerCase().includes('summarize');",
    "const needsContext = /page|summarize|takeaway|insight/i.test(q);"
)

# 2. Fix the Brain Chat logic
old_chat_block = """      if (aiStatus !== 'no') {
        const vaultContext = results.map(r => `[Vault] ${r.bookmark.title}: ${r.bookmark.summary}`).join('\\n');
        const prompt = `You are Brain Vault AI. Answer the user's query accurately.

User Query: ${q}

Current Page Content:
${pageContext.slice(0, 2000)}

Relevant Vault Memories:
${vaultContext}

Answer concisely and format your output in markdown. Use bold and bullet points.`;
        const aiResponse = await aiService.generateText(prompt);
        setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
      } else {
        if (needsContext) {
           setMessages(prev => [...prev, { role: 'assistant', content: `To analyze "this page", please enable Google Chrome's Built-in AI Prompt API. Without it, I can only search your existing vault memories.

**To enable:**
1. Go to \\`chrome://flags/#prompt-api-for-extension\\` and enable it
2. Go to \\`chrome://flags/#optimization-guide-on-device-model\\` and select Enabled BypassPerfRequirement
3. Restart Chrome` }]);
        }"""

new_chat_block = """      if (aiStatus === 'readily' || aiStatus === 'after-download') {
        const vaultContext = results.map(r => `[Vault] ${r.bookmark.title}: ${r.bookmark.summary}`).join('\\n');
        const prompt = `You are Brain Vault AI. Answer the user's query accurately.\\n\\nUser Query: ${q}\\n\\nCurrent Page Content:\\n${pageContext.slice(0, 2000)}\\n\\nRelevant Vault Memories:\\n${vaultContext}\\n\\nAnswer concisely and format your output in markdown. Use bold and bullet points.`;
        const aiResponse = await aiService.generateText(prompt);
        setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);
      } else {
        if (needsContext) {
           setMessages(prev => [...prev, { role: 'assistant', content: `To analyze "this page", Chrome Built-in AI is required. Current status: **${aiStatus}**.\\n\\nPlease ensure:\\n1. \\`chrome://flags/#prompt-api-for-extension\\` is Enabled\\n2. \\`chrome://flags/#optimization-guide-on-device-model\\` is Enabled BypassPerfRequirement\\n3. You have restarted Chrome.` }]);
        }"""

code = code.replace(old_chat_block, new_chat_block)

# 3. Fix the Ghost Writer logic
old_ghost_block = """      if (aiStatus !== 'no') {
        const prompt = `You are an expert Ghost Writer. Write an email drafting the following request.
Tone: ${ghostTone}
Instructions: ${ghostPrompt}

Context from current webpage title: ${ctx.title}
Webpage content: ${ctx.body.slice(0,1000)}

Related facts from user's vault:
${vaultText}

Write only the email draft, nothing else. Do not hallucinate data not provided in the context.`;
        const draft = await aiService.generateText(prompt);
        setGhostDraft(draft);
      } else {
        setGhostDraft(`[Generative AI currently disabled]

Please enable Chrome's Built-in AI to use Ghost Writer email generation.

**To enable:**
1. Go to chrome://flags/#prompt-api-for-extension
2. Enable the flag
3. Restart Chrome

Context found for your prompt:
${vaultText}`);
      }"""

new_ghost_block = """      if (aiStatus === 'readily' || aiStatus === 'after-download') {
        const prompt = `You are an expert Ghost Writer. Write an email drafting the following request.\\nTone: ${ghostTone}\\nInstructions: ${ghostPrompt}\\n\\nContext from current webpage title: ${ctx.title}\\nWebpage content: ${ctx.body.slice(0,1000)}\\n\\nRelated facts from user's vault:\\n${vaultText}\\n\\nWrite only the email draft, nothing else. Do not hallucinate data not provided in the context.`;
        const draft = await aiService.generateText(prompt);
        setGhostDraft(draft);
      } else {
        setGhostDraft(`[Generative AI currently disabled]\\n\\nStatus: ${aiStatus}\\n\\nPlease enable Chrome's Built-in AI to use Ghost Writer email generation.\\n\\n**To enable:**\\n1. Go to chrome://flags/#prompt-api-for-extension\\n2. Enable the flag\\n3. Restart Chrome\\n\\nContext found for your prompt:\\n${vaultText}`);
      }"""

code = code.replace(old_ghost_block, new_ghost_block)

with open("src/sidepanel.tsx", "w") as f:
    f.write(code)
print("Sidepanel patched successfully")
