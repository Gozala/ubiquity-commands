Components.utils.import('resource://xmpp4moz/xmpp.jsm');
var $ = jQuery;
// Noun 
var Contact = {
    _name : 'contact',
    get contacts() {
        var nm = new Namespace('jabber:iq:roster');
        var users = XMPP.cache.all(
           XMPP.q().
               event('iq').
               direction('in').
               type('result').
               child('jabber:iq:roster', 'query'));
        var contacts = [];
        for each (var user in users) {
            var userContacts = user.stanza.nm::query.nm::item;
            for each(var contact in userContacts) {
                contacts.push({
                    owner : user.account,
                    jid : contact.@jid,
                    name : contact.@name
                });
            }
        }
        return contacts;
    },
    suggest : function(text, html, makeSuggestion) {
        var filter = new RegExp('[\s\S]*' + text + '[\s\S]*','i');
        return this.contacts.filter(function(contact) {
            return filter.test(contact.name);
        }).map(function(contact){
            return {
                text : contact.name,
                summary : contact.name + ' (' + contact.owner + ')',
                html : contact.name + ' (' + contact.owner + ')',
                data : contact
            }
        });
    }
};

// Command Chat
CmdUtils.CreateCommand({
    name: "chat",
    icon: "http://www.sameplace.cc/files/zen-sameplace_favicon.png",
    description: "Helps you to communicate with your conatcts at same place",
    author: { name: "Irakli Gozalishvili", email: "rfobic@gmail.com"},
    homepage: 'http://rfobic.wordpress.com/',
    help: 'Type open and contact name to send a message',
    takes: {"contact": Contact},
    
    preview: function(pblock, noun, modifiers) {
        pblock.innerHTML =
        <div>
            {'will open chat with ' + noun.text}
        </div>
    },

    execute: function(noun) {
        displayMessage({
            title : 'SamePlace',
            text : 'Max has data here : ' + noun.toSource(),
            icon : this.icon
        });
    }
});