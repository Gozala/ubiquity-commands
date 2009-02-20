// Noun 
var noun_type_contacts = {
    get contacts() {
        var nm = new Namespace('jabber:iq:roster');
        var users = XMPP.cache.all(
           XMPP.q().
               event('iq').
               direction('in').
               type('result').
               child('jabber:iq:roster', 'query'));
        var contacts = [];
        for each (let user in users) {
            let userContacts = user.stanza.nm::query.nm::item;
            for each(let contact in userContacts) {
                contacts.push({
                    owner : user.account,
                    jid : contact.@jid,
                    name : contact.@name
                });
            }
        }
        return contacts;
    }
}

// Command Chat
var URL = null;
CmdUtils.CreateCommand({
    name: "chat",
    icon: "http://www.sameplace.cc/files/zen-sameplace_favicon.png",
    description: "Helps you to communicate with your conatcts at same place",
    author: { name: "Irakli Gozalishvili", email: "rfobic@gmail.com"},
    homepage: 'http://rfobic.blogspot.com/2008/10/ubiquity-command-chat.html',
    help: 'Type your text and contact name to send a message',
    takes: {"msg": noun_arb_text},
    modifiers: {"with": noun_type_contacts},
    
    preview: function(pblock, noun, modifiers) {
        var self = this;
        this.pblock = jQuery(pblock);
        

        pblock.innerHTML = CmdUtils.renderTemplate(
                '\n<div>\n\t<img id="loader" src="chrome://global/skin/icons/loading_16.png" alt=""/>' +
                '\n\t<strong id="message-bar"></strong>\n</div>' +
                '\n<div id="text-bar" style="font-size: 11px;"></div>\n' +
                '\n<iframe style="visibility: hidden" id="player" width="100%" height="100%" src="about:blank" >' +
                '\n</iframe>',
                {
                    text : this.text[1]
                }
        );
        
        this.frame = this.pblock.find("iframe")[0];
        this.loader = this.pblock.find("#loader")[0];
        this.messageBar = this.pblock.find("#message-bar");
        this.textBar = this.pblock.find("#text-bar");
        
        
        this.text = noun.text.split(/([\s\S]{1,300})(?=\s|$)/gm);
        this.frame.addEventListener('load',function() {
            if (self.frame.contentDocument.location != 'about:blank') {
                var player = jQuery(self.frame.contentDocument).find('video')[0];
                player.addEventListener('ended', function() {
                    self.playNextPart.call(self);
                }, true);
            }
        }, true);

        this.playNextPart();
    },

    execute: function(noun) {
        window.getBrowser().selectedTab = window.getBrowser().addTab(URL);
    },
    
    // Core
    pblock : null,
    
    voice : 'crystal',
    
    serviceURL : 'http://192.20.225.55/tts/cgi-bin/nph-talk',
    
    text : [],
    
    url : '',
    
    frame : null,
    
    messageBar : null,
    
    textBar : null,
    
    loader : null,
    
    textToUrl: function(text) {
        return jQuery.ajax({
                    url : this.serviceURL,
                    type: "POST",
                    async : false,
                    data : {
                        voice : this.voice,
                        txt : text,
                    }
        }).channel.URI.spec;
    },
    
    playNextPart : function() {
        this.text.shift();
        while (this.text[0] == '')
            this.text.shift();
        if (this.text.length > 0) {
            this.loader.style.visibility = 'visible';
            this.messageBar.text('Converting text to speech:');
            this.textBar.text(this.text[0]);
            this.url = this.textToUrl(this.text[0]);
            this.frame.src = this.url;
            this.loader.style.visibility = 'hidden';
            this.messageBar.text('Pronouncing text:');
        } else {
            this.messageBar.text('Finished pronouncing the text');
            this.textBar.text('');
        }
    }
});