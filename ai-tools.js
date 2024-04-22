var aiToolsReady= false;

Hooks.once('init', async function() {
    game.settings.register("ai-tools", "openaiApiKey", {
        name: "OpenAI API Key",
        hint: "Get one from openai.com. This is required to generate images using OpenAI's DallE-3 model. As of April 21, 2024, A standard image costs $0.04 USD and an HD image costs $0.08 USD. (Charged by OpenAI)",
        scope: "world",
        config: true,
        type: String,
    });
    game.settings.register("ai-tools", "sd3ApiKey", {
        name: "Stable Diffusion 3 API Key",
        hint: "Get one from platform.stability.ai. This is required to generate images using Stability AI's Stable Diffusion 3 model.",
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

    game.settings.register("ai-tools", "hd", {
        name: "Generate HD Images (DallE-3)",
        hint: "HD images have higher quality and consistency, but cost more.",
        scope: "world",
        config: true,
        type: Boolean,
    });
    game.settings.register("ai-tools", "style", {
        name: "Image Style (DallE-3):",
        hint: "The style of the generated images. Must be one of vivid or natural. Vivid causes the model to lean towards generating hyper-real and dramatic images. Natural causes the model to produce more natural, less hyper-real looking images",
        scope: "world",
        config: true,
        type: String,
        choices: {
            "vivid": "Vivid",
            "natural": "Natural"
        },
        default: "vivid"
    });

    game.settings.register("ai-tools", "service-token", {
        name: "Service to use for tokens",
        hint: "You can choose which service you wish to use for tokens. The default is OpenAI, but you can use other services in the future.",
        scope: "world",
        config: true,
        type: String,
        choices: {
            "openai": "OpenAI",
            "sd3": "Stable Diffusion 3"
        },
    });
    
    console.log("AI-Tools Loaded")
    r = await FilePicker.createDirectory('data', 'ai-images');
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
    let portrait;
    if (game.system.id=='dnd5e') {
        portrait = html.find('.profile');
    } else if (game.system.id=='pf2e') {
        portrait = html.find('.profile-img');
    } else {
        console.error("AI-Tools: Unsupported system. Please report this to the developer.");
        return [null, null];
    }
    const portrait_parent = portrait.parent();
    portrait_parent.css('position', 'relative');
    const overlay = $('<div style="transition: background-color 4s ease; position:absolute;top:0px;left:0px;width:17px;height:auto;background-color:white;padding-top:2px;padding-left:2px" id="ai-tools-refresh-image"><i class="fa-solid fa-recycle"></i></div>');        
    portrait_parent.append(overlay);
    return [overlay, portrait];
}

function getOpenAIPromptData(prompt) {
    let quality = game.settings.get("ai-tools", "hd") ? "hd" : "standard";
    let style = game.settings.get("ai-tools", "style");
    return {
        "model": "dall-e-3",
        "prompt": prompt,
        "n": 1,
        "size": "1024x1024",
        "response_format": "b64_json",
        "quality": quality,
        "style": style
    };    
}

function getSD3PromptData(prompt) {
    let formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('output_format', 'webp');
    formData.append('style-preset', 'fantasy-art');
    formData.append('model', 'sd3-turbo');
    return formData;
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
        prompt = `minimalistic icon for a ${item.type} called ${item.name}.`;
        if (item.system.type.value === 'natural') {
            prompt += ` It is a natural weapon or a part of the body of a creature`;
        }
        /*
        let desc = item.system.description.value.replace(/<[^>]*>?/gm, '');
        if (desc.length > 0) {
            prompt += "\n\nThe following is the description of the item as used for a role playing game. You can ignore the mechanics, but draw inspiration of what the item might look like based on the description." + desc
        }
        */
        getNewPortrait(prompt, async (b64) => {
            const random_uuid = getUUID();
            await ImageHelper.uploadBase64(b64, `${random_uuid}.webp`, 'ai-images')
            html.find('.profile')[0].src=`ai-images/${random_uuid}.webp`;
            item.update({'prototypeToken.texture.src': `ai-images/${random_uuid}.webp`})
            item.update({'img': `ai-images/${random_uuid}.webp`});
        }, 0, {quality:'standard', style: 'natural'});
    });
});

Hooks.on('renderActorSheet', (sheet, html) => {
    drawActorSheetOverlay(sheet, html);
});

Hooks.on('renderNPCSheetPF2e', (sheet, html) => {
    drawActorSheetOverlay(sheet, html);
});

function drawActorSheetOverlay(sheet, html) {
    if (!game.user.isGM) return;

    if (sheet.actor.type === 'npc') {
        var overlay = createRefreshImageButton(html)[0];

        overlay.on('click', async () => {
            if (!game.settings.get("ai-tools", "openaiApiKey")) {
                ui.notifications.error("Please set your OpenAI API key in the settings.");
                return;
            }
            var actor = sheet.actor;
            let prompt = `A highly detailed and realistic portrait of a ${actor.name}, a ${actor.system.details.type.value} in a fantasy world. It should be depicted standing in its natural environment`;
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
}

function fetchFromOpenAI(data, docUpdateCallBack, nid, retry) {
    console.log('HERE OPENAI')
    return fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${game.settings.get("ai-tools", "openaiApiKey")}`
        },
        body: JSON.stringify(data)
    });
}

function fetchFromSD3(data, docUpdateCallBack, nid, retry) {
    return fetch("https://api.stability.ai/v2beta/stable-image/generate/core", {
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Authorization": `Bearer ${game.settings.get("ai-tools", "sd3ApiKey")}`
        },
        body: data
    });
}

function getNewPortrait(prompt, docUpdateCallBack = () => {}, retry = 0, options = {}) {
    options.type ||= 'portrait';
    var nid = ui.notifications.info("Generating new portrait. Please be patient, this could take a few seconds. You will be notified when the image is ready.", {permanent: true});

    console.log(prompt);

    const data = (options.type=='token' && game.settings.get("ai-tools", "service-token") === 'sd3') ? getSD3PromptData(prompt) : getOpenAIPromptData(prompt);
    var interval = startInProgress();
    console.log(game.settings.get("ai-tools", "service-token"));
    let promise = (options.type=='token' && game.settings.get("ai-tools", "service-token") === 'sd3') ? fetchFromSD3(data, docUpdateCallBack, nid, retry) : fetchFromOpenAI(data, docUpdateCallBack, nid, retry);
    promise.then(response => {
        ui.notifications.remove(nid);
        if (!response.ok) {
            ui.notifications.error("Failed to contact image servers. Please try again later.");
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
        console.log(data);
        const b64 = "data:image/webp;base64," + (options.type=='token' && game.settings.get("ai-tools", "service-token") === 'sd3' ? data.image : data.data[0].b64_json)
        console.log(b64);
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
    if (game.settings.get("ai-tools", "service-token") == "openai" && !game.settings.get("ai-tools", "openaiApiKey")) {
        ui.notifications.error("Please set your OpenAI API key in the settings.");
        return;
    } else if (game.settings.get("ai-tools", "service-token") == "sd3" && !game.settings.get("ai-tools", "sd3ApiKey")) {
        ui.notifications.error("Please set your Stable Diffusion 3 API key in the settings.");
        return;
    }

    const actor = token.actor;
    var prompt = `A 2-dimensional top-down token for an NPC called "${actor.name}" in a fantasy world.` + 
        `The token is a wooden ring containing a portrait of the character. The portrait should be a vivid, but realistic color. ` +
        `The background of the image should be a single color, and the token should be centered in the image. `;
    if (actor.flags.aitoolsPrompt) {
        prompt += "\n\n The following is a more accurate description of what should be inside the ring of the token: " + actor.flags.aitoolsPrompt;
    }

    if (game.settings.get("ai-tools", "service-token") === 'openai') {
        let bio = actor.system.details.biography.value.replace(/<[^>]*>?/gm, '');
        if (bio.length > 0) prompt += "\n\nThe following was provided as the biography of the NPC. You can ignore the mechanics, but draw inspiration of what the character might look like based on the description:\n" + bio
    }

    getNewPortrait(prompt, async (b64) => {
        const random_uuid = getUUID();
        await ImageHelper.uploadBase64(b64, `${random_uuid}.webp`, 'ai-images')
        token.isUpdating = true;
        token.update({
            'texture.src': `ai-images/${random_uuid}.webp`,
            'flags.aiToolsImage': true
        })
    }, 0, {type:'token'});
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