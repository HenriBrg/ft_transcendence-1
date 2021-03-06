AppClasses.Views.Conversations = class extends AppClasses.Views.AbstractView {
	constructor(opts) {
		opts.events = {
			"submit #sendRoomMessageForm": "submit",
			"submit .createDM": "createDM",
			"submit #sendDuelRequest": "sendDuelRequest",
			"submit .AcceptDuelRequest": "AcceptDuelRequest",
		}
		super(opts);
		this.tagName = "div";
        this.template = App.templates["messages/show"];
		this.user = App.models.user;
		this.chatID = opts.chatID;
		this.model = opts.model;
		this.allUsers = App.collections.allUsers;
		this.guilds = App.collections.guilds;
		this.listenTo(this.model, "change reset add remove", this.updateRender);
		this.listenTo(App.collections.allUsers, "change reset add remove", this.updateRender);
		this.listenTo(this.guilds, "change reset add remove", this.updateRender);
		this.model.fetch();
		this.allUsers.myFetch();
		this.guilds.fetch();
		this.updateRender();
	}

	AcceptDuelRequest(e)
	{
		e.preventDefault();
		if (!this.verif_accept_request(e)) return (false);
		var selectorFormID = "";
		if (e.currentTarget) selectorFormID = "#" + e.currentTarget.id;
		App.utils.formAjax("/api/direct_chats/acceptDuelRequest.json", selectorFormID)
		.done(res => {
			App.toast.success("Duel request accepted !", { duration: 1500, style: App.toastStyle });
		})
		.fail((e) => {
			App.utils.toastError(e);
		});
		return (false);
	}

	sendDuelRequest(e)
	{
		e.preventDefault();
		if (!this.verif_infos(e)) return (false);
		App.utils.formAjax("/api/direct_chats/createDuelRequest.json", "#sendDuelRequest")
		.done(res => {
			App.toast.success("Duel request sent !", { duration: 1500, style: App.toastStyle });
		})
		.fail((e) => {
			App.utils.toastError(e);
		});
		return (false);
	}

    createDM(e) {
		e.preventDefault();
		var selectorFormID = "";
		if (e.currentTarget) selectorFormID = "#" + e.currentTarget.id;
		App.utils.formAjax("/api/direct_chats.json", selectorFormID)
		.done(res => {
			App.toast.success("Room created !", { duration: 1500, style: App.toastStyle });
			location.hash = "#messages/" + res.id;
		})
		.fail((e) => {
			App.utils.toastError(e);
		});
		return (false);
    }
	
	submit(e)  {
		e.preventDefault();
		if (!this.verif_infos(e)) return (false);
		if (!e.currentTarget.message || (e.currentTarget.message && e.currentTarget.message.value == ""))
			return ;
		App.utils.formAjax("/api/chat_messages.json", "#sendRoomMessageForm")
		.done(res => {})
		.fail((e) => {
			App.utils.toastError(e);
		});
		return (false);
	}

	verif_infos(e)
	{
		if (!e.currentTarget || !e.currentTarget[1] || !e.currentTarget[2] // verification null value
			|| e.currentTarget[1].value != this.user.id || e.currentTarget[2].value != this.chatID) // Verification value if not null
		{
			App.toast.alert("Something is wrong with this conversation");
			return (false);
		}
		return (true);
	}

	verif_accept_request(e)
	{
		var currentDMRoom = this.model ? this.model.toJSON() : null;
		var otherUser = null;
		if (currentDMRoom) {
			currentDMRoom = _.filter(currentDMRoom, m => {
				return m.id === this.chatID;
			})[0] || null;
			otherUser = this.user.id === currentDMRoom.user1_id ? currentDMRoom.user2_id : currentDMRoom.user1_id;
		}
		if (!currentDMRoom || !otherUser || !e.currentTarget || !e.currentTarget[1] || !e.currentTarget[2] || !e.currentTarget[3] 
			|| !e.currentTarget[4] || !e.currentTarget[5] // verification null value
			|| e.currentTarget[3].value != otherUser || e.currentTarget[4].value != this.user.id) // Verification users' id
			{
				App.toast.alert("Wrong duel request");
				return (false);
			}
		return (true);
	}

    updateRender() {

		var currentDMRoom = this.model ? this.model.toJSON() : null;
		if (currentDMRoom) {
			currentDMRoom = _.filter(currentDMRoom, m => {
				return m.id === this.chatID;
			})[0] || null;
		}

		var currentUser = null;
		if (this.user) currentUser = this.user.attributes;
	
		var otherUser = null;
		var usersNonBlocked = null;
		var guilds = null;
		if (currentDMRoom)
		{
			var directMessages = currentDMRoom.direct_messages;
			var otherUserID = (this.user.id === currentDMRoom.user1_id) ? currentDMRoom.user2_id : currentDMRoom.user1_id;
			var allUsers = App.collections.allUsers.models;
			for (var count = 0; count < allUsers.length; count++)
			{
				if (allUsers[count].attributes.id == otherUserID)
					otherUser = allUsers[count].attributes;
				else if (allUsers[count].attributes.id == currentUser.id)
					currentUser = allUsers[count].attributes;
			}
			if (currentUser) {

				if (this.guilds) guilds = this.guilds.toJSON();
				// Assert that currentUser is one of the 2 user in the current DM room
				if (currentDMRoom.user1_id != currentUser.id && currentDMRoom.user2_id != currentUser.id) {
					location.hash = '#messages';
					return (false);
				}
				// Assert currentUser have not been blocked by the other user
				if (otherUser && otherUser.blocked && location.hash == ('#messages/' + currentDMRoom.id)) {
					otherUser.blocked.forEach(block => {
						if (block.toward_id == currentUser.id) {
							location.hash = '#messages';
							App.toast.alert("You've been blocked", { duration: 2000, style: App.toastStyle })
							return (false);
						}
					});
				}
				var blocked = currentUser.blocked || null;
				if (blocked) {
					var blockedTabIDs = [];
					blocked.forEach(block => {
						blockedTabIDs.push(block.toward_id);
					});
					usersNonBlocked = this.allUsers.models.filter(user => {
						return (user.id != currentUser.id && !blockedTabIDs.includes(user.id))
					});
				}
			}
		}
		this.$el.html(this.template({
			dmRooms: this.model,
			allUsers: usersNonBlocked ? usersNonBlocked : this.allUsers.models,
			userID: this.user.id,
			chatID: this.chatID,
			guilds: guilds,
			currentUser: currentUser,
			otherUser: otherUser,
			currentDMRoom: currentDMRoom,
			directMessages: directMessages,
			isTrue: true,
			isFalse: false,
			token: $('meta[name="csrf-token"]').attr('content')
		}));
		this.delegateEvents();
		return (this);
    }
    
	render(chatID) {
		if (this.chatID != chatID) {
			this.chatID = chatID;
			this.updateRender();
		}
		this.model.fetch();
		this.delegateEvents();
		return (this);
	}

}
