Components.utils.import('resource://xmpp4moz/xmpp.jsm');
Components.utils.import('resource://xmpp4moz/namespaces.jsm');
var srvIO = Cc['@mozilla.org/network/io-service;1']
    .getService(Ci.nsIIOService);
 
var $ = jQuery;
 
var Contact = {
    _name : 'contact',
 
    get contacts() {
        var rosters = XMPP.cache.all(
            XMPP.q()
                .event('iq')
                .direction('in')
                .type('result')
                .child(ns_roster, 'query'));
 
        var contacts = [];
        for each(var roster in rosters) {
            for each(var item in roster.stanza..ns_roster::item) {
                contacts.push({
                    account : roster.account,
                    address : item.@jid.toString(),
                    name : item.@name.toString()
                });
            }
        }
        return contacts;
    },
 
    suggest: function(text, html, makeSuggestion) {
        text = text.toLowerCase();
 
        return this.contacts
            .filter(function(contact) {
                return (contact.name.toLowerCase().indexOf(text) != -1 ||
                        contact.address.toLowerCase().indexOf(text) != -1);
            })
            .map(function(contact) {
                return {
                    text : contact.name || contact.address,
                    summary : contact.name || XMPP.JID(contact.address).node,
                    html : contact.name,
                    data : contact
                }
            });
    }
};

var Message = {
    _name : 'message',
    suggest: function(text, html, makeSuggestion) {
        var suggestions = [];
        text = text.toLowerCase();
        switch (text) {
            case '':
                suggestions.push({
                    text : '',
                    summary : '',
                    data : {
                        type : 'chat'
                    }
                });
                break;
            case 'url':
                suggestions.push({
                    text : text,
                    summary : Application.activeWindow.activeTab.uri.spec,
                    data : {
                        type : 'link',
                        url : Application.activeWindow.activeTab.uri.spec
                    }
                });
                break;
            default :
                suggestions.push({
                    text : text.substr(0,10) + '...',
                    summary : text.substr(0,10) + '...',
                    html : html,
                    data : {
                        type : 'text',
                        text : text
                    }
                });
                break;
        }
        return suggestions;
    },
    default : function() {
        return {
            text : '',
            summary : '',
            data : {
                type : 'chat'
            }
        };
    }
};

CmdUtils.CreateCommand({
    name: 'im',
    icon: 'chrome://sameplace/skin/logo16x16.png',
    description: 'Open chat in SamePlace',
    author: { name: 'Irakli Gozalishvili', email: 'rfobic@gmail.com'},
    contributors: [ 'Massimiliano Mirra' ],
    homepage: 'http://rfobic.wordpress.com/',
    help: 'Type "im" and contact name to open a chat',
    takes: {'message': Message},
    modifiers : {
        'to' : Contact
    },
 
    preview: function(pblock, noun, modifiers) {
        var contact = modifiers.to.data;
        var message = modifiers.message;
        
        var name = contact.name || XMPP.JID(contact.address).node;
        var account = contact.account;
        var address = contact.address;
 
        var presence = XMPP.presencesOf(account, address)[0];
        var imgUrl;
        if(!presence || presence.stanza.@type == 'unavailable')
            imgUrl = 'resource://sameplace/icons/status16x16-unavailable.png';
        else if(presence.stanza.show == 'away')
            imgUrl = 'resource://sameplace/icons/status16x16-away.png';
        else if(presence.stanza.show == 'dnd')
            imgUrl = 'resource://sameplace/icons/status16x16-dnd.png';
        else if(presence.stanza.@type == undefined)
            imgUrl = 'resource://sameplace/icons/status16x16-available.png';

        
        pblock.innerHTML = <div>Open chat with <img src={imgUrl}/>{name} (<em>{address}</em>)</div>;
    },
 
    execute: function(takes, modifiers) {
        var contact = modifiers.to.data;
        var message = takes.data;
        switch (message.type) {
            case 'chat':
                srvIO.newChannel('xmpp://' + contact.account + '/' + contact.address,
                                 null, null)
                    .asyncOpen(null, null);
                break;
            case 'link':
                displayMessage({
                    icon : this.icon,
                    title : 'Send a link',
                    text : message.url
                });
                break;
            case 'text':
                displayMessage({
                    icon : this.icon,
                    title : 'Send text',
                    text : message.text
                });
                break;
        }
    }
});