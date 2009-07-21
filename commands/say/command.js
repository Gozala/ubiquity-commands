if (!Function.prototype.bind) Function.prototype.bind = function () {
    var args = Array.prototype.slice.call(arguments);
    var self = this;
    var bound = function () {
        return self.call.apply(
            self,
            args.concat(
                Array.prototype.slice.call(arguments)
            )
        );
    };
    bound.name = this.name;
    bound.displayName = this.displayName;
    bound.length = this.length;
    bound.unbound = self;
    return bound;
};

var Sampler = function(text, element) {
    this.player = element;
    this.player.addEventListener('ended', this.next.bind(this), true);
    this.playlist = [];
    this.subscribers = [];
    this.chunks = text.split(/([\s\S]{1,300})(?=\s|$)/gm).filter(function(chunk) chunk != "");
    this.getTrack();
};
Sampler.prototype = {
    voice: "crystal",
    serviceURL: "http://192.20.225.55/tts/cgi-bin/nph-talk",
    chunks: null,
    player: null,
    playlist: null,
    subscribers: null,
    getTrack: function() {
        var text = this.chunks.shift();
        $.ajax({
            url : this.serviceURL,
            type: "POST",
            cache: false,
            complete: (function(request) {
                this.playlist.push({ 
                    url: request.channel.URI.spec, 
                    text: text
                });
                this.next();
                if(this.chunks.length > 0) this.getTrack();
            }).bind(this),
            data : {
                voice : this.voice,
                txt : text
            }
        });
    },
    next: function() {
        if ((this.player.paused || this.player.ended) && this.playlist.length) {
            var track = this.playlist.shift();
            this.publish(track);
            this.player.src = track.url;
            this.player.load();
            this.player.play();
        }
    },
    publish: function(data) {
        this.subscribers.forEach(function(subscriber) {
            if (typeof subscriber == "function") subscriber(data);
        });
    },
    subscribe: function(subscriber) {
        this.subscribers.push(subscriber);
    }
};
var $ = jQuery;
if (CmdUtils.parserVersion == 2) {
    CmdUtils.CreateCommand({
        names: ["say", "pronounce", "text to speech"],
        //icon: "http://",
        description: "Pronounces the selected/specified text",
        author: { name: "Irakli Gozalishvili", email: "rfobic@gmail.com"},
        homepage: 'http://gozala.github.com/ubiquity/commands/say/',
        help: 'Select or type text to pronounce it',
        arguments: [{
            role: "object",
            nountype: noun_arb_text,
            label: "sentence"
        }],
        preview: function preview(pblock, args) {
            $(pblock).html(CmdUtils.renderTemplate(
                    '\n<div>\n\t<img id="loader" src="chrome://global/skin/icons/loading_16.png" alt=""/>' +
                    '\n\t<strong id="message-bar"></strong>\n</div>' +
                    '<br/><br/>' +
                    '\n<div id="text-bar" style="font-size: 11px;"></div>\n' +
                    '\n<audio id="player"></audio>'
            ));
            var loader = $("#loader", pblock)[0];
            var messageBar = $("#message-bar", pblock);
            var textBar = $("#text-bar", pblock);

            var sampler = new Sampler(args.object.text, $("#player", pblock)[0]);
            sampler.subscribe(function(data) {
                loader.style.visibility = 'hidden';
                messageBar.text('Pronouncing text:');
                textBar.text(data.text);
            });
        },
        execute: function(args) {
            window.getBrowser().selectedTab = window.getBrowser().addTab(URL);
        }
    });
} else {
    CmdUtils.CreateCommand({
        name: "say",
        //icon: "http://",
        description: "Pronounces the selected/specified text",
        author: { name: "Irakli Gozalishvili", email: "rfobic@gmail.com" },
        homepage: 'http://rfobic.blogspot.com/2008/10/ubiquity-command-say.html',
        help: 'Select or type the text to pronounce it',
        takes: { "sentence": noun_arb_text },
        preview: function(pblock, noun) {
            $(pblock).html(CmdUtils.renderTemplate(
                    '\n<div>\n\t<img id="loader" src="chrome://global/skin/icons/loading_16.png" alt=""/>' +
                    '\n\t<strong id="message-bar"></strong>\n</div>' +
                    '<br/><br/>' +
                    '\n<div id="text-bar" style="font-size: 11px;"></div>\n' +
                    '\n<audio id="player"></audio>'
            ));
            var loader = $("#loader", pblock)[0];
            var messageBar = $("#message-bar", pblock);
            var textBar = $("#text-bar", pblock);

            var sampler = new Sampler(noun.text, $("#player", pblock)[0]);
            sampler.subscribe(function(data) {
                loader.style.visibility = 'hidden';
                messageBar.text('Pronouncing text:');
                textBar.text(data.text);
            });
        },
        execute: function(noun) {
            window.getBrowser().selectedTab = window.getBrowser().addTab(URL);
        },
    });
}

