const chromium = require('chrome-aws-lambda');
const nodemailer = require('nodemailer');

// Email templates
const TEMPLATES = [
    {
        subject: "Quick question about our meeting next week",
        body: `Hi there,

I wanted to check if the meeting time next Tuesday still works for you? I have a couple of updates to share.

Best regards`
    },
    {
        subject: "Following up on our conversation",
        body: `Hello,

It was great chatting with you earlier. I wanted to follow up on what we discussed. Let me know if you have any questions!

Thanks`
    },
    {
        subject: "Interesting article I found",
        body: `Hey,

I came across this article and thought you might find it interesting. It relates to what we were talking about recently.

Cheers`
    },
    {
        subject: "Project update",
        body: `Hello,

Just wanted to give you a quick update on the project. Everything is on track and looking good. I'll send more details next week.

Best`
    },
    {
        subject: "Thanks for your help",
        body: `Hi,

I just wanted to say thanks again for your help with this. I really appreciate it!

Have a great day`
    }
];

// Generate random text
function generateRandomText(minWords = 20, maxWords = 50) {
    const words = [
        "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing",
        "elit", "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore",
        "et", "dolore", "magna", "aliqua", "ut", "enim", "ad", "minim", "veniam",
        "quis", "nostrud", "exercitation", "ullamco", "laboris", "nisi"
    ];
    
    const numWords = Math.floor(Math.random() * (maxWords - minWords + 1)) + minWords;
    const selectedWords = [];
    for (let i = 0; i < numWords; i++) {
        selectedWords.push(words[Math.floor(Math.random() * words.length)]);
    }
    
    let text = selectedWords.join(" ");
    return text.charAt(0).toUpperCase() + text.slice(1) + ".";
}

// Generate AI-like message
function generateAIMessage() {
    const subjects = [
        "Checking in on our discussion",
        "Thought you might find this interesting",
        "Quick follow-up question",
        "Catching up",
        "Project status update"
    ];
    
    const bodies = [
        "I was just thinking about our conversation the other day and wanted to follow up. Let me know if you have any thoughts!",
        "I came across something that reminded me of our discussion. Hope you're doing well!",
        "Quick question about what we discussed - do you have a moment to clarify something?",
        "It's been a while! I wanted to check in and see how things are going on your end.",
        "Just wanted to let you know that I'm making good progress on what we talked about. I'll have more updates soon."
    ];
    
    return {
        subject: subjects[Math.floor(Math.random() * subjects.length)],
        body: bodies[Math.floor(Math.random() * bodies.length)] + "\n\nBest"
    };
}

// Generate email content
function generateContent(mode) {
    if (mode === 'random') {
        return {
            subject: `Quick note ${new Date().toISOString().split('T')[0]}`,
            body: generateRandomText()
        };
    } else if (mode === 'ai') {
        return generateAIMessage();
    } else {
        const template = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
        return {
            subject: template.subject,
            body: template.body
        };
    }
}

// Sleep function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Send email using Gmail API via Puppeteer
async function sendEmailViaGmail(browser, email, password, to, content) {
    const page = await browser.newPage();
    
    try {
        // Navigate to Gmail
        await page.goto('https://mail.google.com', { waitUntil: 'networkidle0' });
        
        // Login
        await page.type('#identifierId', email);
        await page.click('#identifierNext');
        await sleep(2000 + Math.random() * 2000);
        
        await page.type('input[name="Passwd"]', password);
        await page.click('#passwordNext');
        await sleep(5000 + Math.random() * 3000);
        
        // Click compose
        await page.waitForSelector('div[role="button"][gh="cm"]');
        await page.click('div[role="button"][gh="cm"]');
        await sleep(2000);
        
        // Fill recipient
        await page.type('textarea[name="to"]', to);
        await sleep(1000);
        
        // Fill subject
        await page.type('input[name="subjectbox"]', content.subject);
        
        // Fill body
        await page.click('div[aria-label="Message Body"]');
        await page.type('div[aria-label="Message Body"]', content.body);
        
        // Send
        await sleep(2000 + Math.random() * 3000);
        await page.click('div[aria-label*="Send"]');
        
        await sleep(3000);
        return true;
        
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    } finally {
        await page.close();
    }
}

// Main handler
module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { email, password, target, addresses, count, mode } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }
    
    let browser = null;
    const results = {
        success: 0,
        failed: 0,
        logs: []
    };
    
    try {
        // Launch browser
        browser = await chromium.puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath,
            headless: chromium.headless,
        });
        
        const emailList = target ? 
            Array(parseInt(count) || 1).fill(target) : 
            addresses.split('\n').map(a => a.trim()).filter(a => a);
        
        for (let i = 0; i < emailList.length; i++) {
            const recipient = emailList[i];
            const content = generateContent(mode);
            
            results.logs.push(`Sending email ${i + 1}/${emailList.length} to ${recipient}`);
            
            const success = await sendEmailViaGmail(
                browser, email, password, recipient, content
            );
            
            if (success) {
                results.success++;
                results.logs.push(`✓ Sent to ${recipient}`);
            } else {
                results.failed++;
                results.logs.push(`✗ Failed to send to ${recipient}`);
            }
            
            // Delay between emails
            if (i < emailList.length - 1) {
                const delay = 10000 + Math.random() * 20000;
                results.logs.push(`Waiting ${Math.round(delay/1000)}s before next email...`);
                await sleep(delay);
            }
        }
        
        results.logs.push(`Completed: ${results.success} successful, ${results.failed} failed`);
        
    } catch (error) {
        console.error('Error:', error);
        results.logs.push(`Error: ${error.message}`);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
    
    res.json(results);
};
