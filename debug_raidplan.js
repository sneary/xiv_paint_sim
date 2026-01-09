const https = require('https');

const url = "https://raidplan.io/plan/syjvfhacdxz7awet";
const options = {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
};

https.get(url, options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        // Check for og:image
        const ogImage = data.match(/<meta property="og:image" content="([^"]+)"/);
        console.log("OG Image:", ogImage ? ogImage[1] : "None");

        // Check for twitter:image
        const twitterImage = data.match(/<meta name="twitter:image" content="([^"]+)"/);
        console.log("Twitter Image:", twitterImage ? twitterImage[1] : "None");

        const match = data.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
        if (match && match[1]) {
            const json = JSON.parse(match[1]);
            const plan = json.props.pageProps._plan;

            console.log("Plan keys:", Object.keys(plan));
            console.log("Plan name:", plan.name);

            // Check for steps or specific image urls
            if (plan.steps) {
                console.log("Steps found:", plan.steps.length);
                console.log("Step 0:", plan.steps[0]);
            } else {
                console.log("No explicit 'steps' array found.");
            }

            // Check nodes for any image urls
            const arenaNodes = plan.nodes.filter(n => n.type === 'arena');
            console.log("Arena nodes:", arenaNodes.map(n => ({ step: n.meta.step, url: n.attr.imageUrl })));

            // Search for anything looking like a snapshot url
            const str = JSON.stringify(plan);
            const urls = str.match(/https:\/\/[^"]+\.(png|jpg|jpeg|webp)/g);
            console.log("All image URLs found in plan data (first 10):", urls ? [...new Set(urls)].slice(0, 10) : "None");
        } else {
            console.log("No NEXT DATA found");
        }
    });
});
