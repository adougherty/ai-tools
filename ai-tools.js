var aiToolsReady= false;

Hooks.once('init', async function() {
    game.settings.register("ai-tools", "openaiApiKey", {
        name: "OpenAI API Key",
        hint: "Get one from openai.com",
        scope: "world",
        config: true,
        type: String,
    });
    game.settings.register("ai-tools", "generateNewTokens", {
        name: "Generate Images for New Tokens",
        hint: "Automatically generate images for new tokens when they are placed on the canvas",
        scope: "world",
        config: true,
        type: Boolean,
    });

    console.log("AI-Tools Loaded")
    //r = await FilePicker.createDirectory('data', 'ai-images');
});

function uuidv4() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
	.replace(/[xy]/g, function (c) {
		const r = Math.random() * 16 | 0, 
			v = c == 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}

function createRefreshImageButton(html) {
    const portrait = html.find('.profile');
    const portrait_parent = portrait.parent();
    portrait_parent.css('position', 'relative');
    const overlay = $('<div style="transition: background-color 4s ease; position:absolute;top:0px;left:0px;width:17px;height:auto;background-color:white;padding-top:2px;padding-left:2px" id="ai-tools-refresh-image"><i class="fa-solid fa-recycle"></i></div>');        
    portrait_parent.append(overlay);
    return [overlay, portrait];
}

function getOpenAIPromptData(prompt) {
    return {
        "model": "dall-e-3",
        "prompt": prompt,
        "n": 1,
        "size": "1024x1024",
        "response_format": "b64_json"
    };    
}

function startInProgress() {
    // Cycle background between yellow and blue with a fade
    var div = $('#ai-tools-refresh-image');
    var isRed = true
    var changeColor = () => {
        if (isRed) {
            div.css('background-color','deepskyblue');
        } else {
            div.css('background-color','red');
        }
        isRed = !isRed;
    };
    var interval = setInterval(() => {
        changeColor();
    }, 4000);
    changeColor();            
    return interval;
}

function getUUID() {
    const random_uuid =
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
    .replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, 
            v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
    return random_uuid;
}

Hooks.on('renderItemSheet', (sheet, html) => {
    if (!game.user.isGM) return;
    var overlay = createRefreshImageButton(html)[0];

    overlay.on('click', async () => {
        if (!game.settings.get("ai-tools", "openaiApiKey")) {
            ui.notifications.error("Please set your OpenAI API key in the settings.");
            return;
        }
        console.log(sheet);
        var item = sheet.item;
        console.log(item);
        prompt = `Simple but realistic icon for a ${item.type} called ${item.name}. The icon should large and fill the image.`;
        if (item.system.type.value === 'natural') {
            prompt += ` It is a natural weapon or a part of the body of a creature`;
        }
        let desc = item.system.description.value.replace(/<[^>]*>?/gm, '');
        if (desc.length > 0) {
            prompt += "\n\nThe following is the description of the item as used for a role playing game. You can ignore the mechanics, but draw inspiration of what the item might look like based on the description." + desc
        }
        getNewPortrait(prompt, async (b64) => {
            const random_uuid = getUUID();
            await ImageHelper.uploadBase64(b64, `${random_uuid}.webp`, 'ai-images')
            html.find('.profile')[0].src=`ai-images/${random_uuid}.webp`;
            item.update({'prototypeToken.texture.src': `ai-images/${random_uuid}.webp`})
            item.update({'img': `ai-images/${random_uuid}.webp`});
        });
    });
});

Hooks.on('renderActorSheet', (sheet, html) => {
    if (!game.user.isGM) return;
    
    if (sheet.actor.type === 'npc') {
        var overlay = createRefreshImageButton(html)[0];

        overlay.on('click', async () => {
            if (!game.settings.get("ai-tools", "openaiApiKey")) {
                ui.notifications.error("Please set your OpenAI API key in the settings.");
                return;
            }
            var actor = sheet.actor;
            var prompt = "";
            if (actor.flags.aitoolsPrompt) {
                prompt = actor.flags.aitoolsPrompt;
            } else {
                prompt = `A highly detailed and realistic portrait of a ${actor.name}, a ${actor.system.details.type.value} in a fantasy world. It should be depicted standing in its natural environment`;
                if (actor.system.abilities.str.value > 16) { prompt += ' It is very strong.'; }
                if (actor.system.abilities.dex.value > 16) { prompt += ' It is very dextrous.'; }
                if (actor.system.abilities.con.value > 16) { prompt += ' It is very hearty.'; }
                if (actor.system.abilities.int.value > 16) { prompt += ' It is very intellilgent.'; }
                if (actor.system.abilities.wis.value > 16) { prompt += ' It is very wise.'; }
                if (actor.system.abilities.cha.value > 16) { prompt += ' It is very charismatic.'; }
                let bio = actor.system.details.biography.value.replace(/<[^>]*>?/gm, '');
                if (bio.length > 0) {
                    prompt += "\n\n" + actor.system.details.biography.value.replace(/<[^>]*>?/gm, '')
                }
            }
            var data = getOpenAIPromptData(prompt);
            getNewPortrait(prompt, async (b64) => {
                const random_uuid = getUUID();
                await ImageHelper.uploadBase64(b64, `${random_uuid}.webp`, 'ai-images')
                html.find('.profile')[0].src=`ai-images/${random_uuid}.webp`;
                actor.update({'prototypeToken.texture.src': `ai-images/${random_uuid}.webp`})
                actor.update({'img': `ai-images/${random_uuid}.webp`});
            });

        });

        const tab_biography = html.find('.tab.biography');
        tab_biography.prepend($(`<h2 style="font-weight:bold;flex: 0 0 auto">Biography</h2>`));
        tab_biography.append($('<h2 style="font-weight:bold;flex: 0 0 auto">AI Image Creation Instructions</h2>'));
        tab_biography.append($(`<div style="font-weight:bold;flex: 0 0 auto"><input type="text" name="flags.aitoolsPrompt" style="width:100%" value="${sheet.actor.flags.aitoolsPrompt || ''}" id="aitoolsPrompt" placeholder="A fierce half-orc tracker carrying a magical notebook"></div>`));
    }
});

function getNewPortrait(prompt, docUpdateCallBack = () => {}, retry = 0) {
    var nid = ui.notifications.info("Generating new portrait. Please be patient, this could take a few seconds. You will be notified when the image is ready.", {permanent: true});
    console.log(prompt);
    const data = getOpenAIPromptData(prompt);
    var interval = startInProgress();
    fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${game.settings.get("ai-tools", "openaiApiKey")}`
        },
        body: JSON.stringify(data)
        })
        .then(response => {
            ui.notifications.remove(nid);
            if (!response.ok) {
                ui.notifications.error("Failed to contact OpenAI servers. Please try again later.");
                return;
                if (retry < 3) {
                    ui.notifications.warn("Failed to contact OpenAI severs. Trying again...");
                    getNewPortrait(prompt, docUpdateCallBack, retry + 1);
                } else {
                    ui.notifications.error("Failed to contact OpenAI servers. Please try again later.");
                }
            } else {
                ui.notifications.info("Image generated.");
            }
            return response.json();
        })
        .then(async (data) => {
            const b64 = "data:image/webp;base64," + data.data[0].b64_json
            console.log(data.data[0]);
            docUpdateCallBack(b64);
            clearInterval(interval);
        })
        .catch(error => console.error('Error:', error));
}


Hooks.on('deleteActor', (actor, options, userid) => {
    if (!game.user.isGM) return;
    //console.log(actor);
});

function base64ToFile(base64Str, filename) {
    let blob = base64ImageToBlob(base64Str);
    return new File([blob], filename, {type: 'image/webp'});
}

function base64ImageToBlob(str) {
    pos = 0;
    type = "image/webp"
    var b64 = str.substr(pos + 8);
  
    // decode base64
    var imageContent = atob(b64);
  
    // create an ArrayBuffer and a view (as unsigned 8-bit)
    var buffer = new ArrayBuffer(imageContent.length);
    var view = new Uint8Array(buffer);
  
    // fill the view, using the decoded base64
    for(var n = 0; n < imageContent.length; n++) {
      view[n] = imageContent.charCodeAt(n);
    }
  
    // convert ArrayBuffer to Blob
    var blob = new Blob([buffer], { type: type });
  
    return blob;
}

function generateTokenImage(token) {
    console.log(token);
    if (!game.settings.get("ai-tools", "openaiApiKey")) {
        ui.notifications.error("Please set your OpenAI API key in the settings.");
        return;
    }

    const actor = token.actor;
    var prompt = `A token for a character in a fantasy world. The token is for use in a virtual tabletop roleplaying game. The token should be a close up of the character's upper body, if possible. The token should be simple enough to be easily recognizable at a small size. The token should be a circle containaing the character's portrait on a white gray background. The portrait should be in full vivid, but realistic color.`;
    if (actor.flags.aitoolsPrompt) {
        prompt += "\n\n The following is a more accurate description of what should be inside the ring of the token: " + actor.flags.aitoolsPrompt;
    }

    let bio = actor.system.details.biography.value.replace(/<[^>]*>?/gm, '');
    if (bio.length > 0) prompt += "\n\nThe following is the description of what should be inside the ring of the token. You can ignore the mechanics, but draw inspiration of what the item might look like based on the description:\n" + bio
    getNewPortrait(prompt, async (b64) => {
        const random_uuid = getUUID();
        await ImageHelper.uploadBase64(b64, `${random_uuid}.webp`, 'ai-images')
        token.isUpdating = true;
        token.update({
            'texture.src': `ai-images/${random_uuid}.webp`,
            'flags.aiToolsImage': true
        })
    });
}

Hooks.on('renderTokenConfig', (app, html) => {
    if (!game.user.isGM) return;

    const AiToolsButton = $(`<button class="ai-tools-button"><i class="fa-solid fa-recycle"></i></button>`);
    const btn_file = html.find(`button[title="Browse Files"]`);
    AiToolsButton.click(async (e) => {
        e.preventDefault();
        btn_file.prop('disabled', true);
        generateTokenImage(app.object);
    });
    btn_file.before(AiToolsButton);
});

Hooks.on('ready', () => {
    aiToolsReady = true;
    console.log("AI-Tools Ready");
});

Hooks.on('drawToken', (token) => {
    if (token.document.flags.aiToolsImage && token.document.flags.aiToolsImage === true) return;
    if (!game.user.isGM) return;
    if (!aiToolsReady) return;
    if (!game.settings.get("ai-tools", "generateNewTokens")) return;
    generateTokenImage(token.document);

});