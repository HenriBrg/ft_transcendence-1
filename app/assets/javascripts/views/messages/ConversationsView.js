AppClasses.Views.Conversations = class extends Backbone.View {
	constructor(opts) {
		opts.events = {
			"submit #sendRoomMessageForm": "submit",
			"submit .createDM": "createDM"
		}
		super(opts);

		this.user = opts.user;
		this.chatID = opts.chatID;
		console.log("---- chat id ------")
		console.log(this.chatID)
		this.model = opts.model;
        this.allUsers = App.collections.allUsers;

		this.listenTo(this.allUsers, "change reset add remove", this.updateRender);
		this.listenTo(this.model, "change reset add remove", this.updateRender);
		this.allUsers.myFetch();
		this.model.fetch();

		this.tagName = "div";
        this.template = App.templates["messages/show"];
		this.updateRender();

	}

    createDM(e) {
		e.preventDefault();

        const selectorFormID = "#" + e.currentTarget.id
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
	
	submit(e) 
	{
		e.preventDefault();
		if (e.currentTarget.message.value == "") {
			// App.toast.message("You cannot send empty message", { duration: 2000, style: App.toastStyle });
			return ;
		}
		App.utils.formAjax("/api/chat_messages.json", "#sendRoomMessageForm")
		.done(res => {
			App.toast.success("Message sent", { duration: 1000, style: App.toastStyle });
			// location.reload();// = `#messages/` + this.chatID;
		})
		.fail((e) => {
			App.utils.toastError(e);
		});
		return (false);
	}

    updateRender() {

		console.log("IPDATE RENDER")
		var currentDMRoom = this.model ? this.model.toJSON() : null;
		if (currentDMRoom)
		{
			currentDMRoom = _.filter(currentDMRoom, m => {
				return m.id === this.chatID;
			})[0] || null;
		}

		var currentUser = null;
		if (this.user) currentUser = this.user.attributes;
	
		var otherUser = null;
		if (currentDMRoom)
		{
			console.log("IN ROOM ===>");
			console.log(currentDMRoom.id)
		}
		else
		{
			console.log("NO ROOM")
		}


		if (currentDMRoom)
		{
			var directMessages = currentDMRoom.direct_messages;
			// console.log("directMessages bfore reverse ====> ")
			// console.log(directMessages);
			directMessages.reverse();
			// console.log("directMessages ====> ")
			// console.log(directMessages);
			var otherUserID = (this.user.id === currentDMRoom.user1_id) ? currentDMRoom.user2_id : currentDMRoom.user1_id;
			var allUsers = App.collections.allUsers.models;
			for (var count = 0; count < allUsers.length; count++)
			{
				if (allUsers[count].attributes.id == otherUserID)
					otherUser = allUsers[count].attributes;
				else if (allUsers[count].attributes.id == currentUser.id)
					currentUser = allUsers[count].attributes;
			}

			// Check if 
			if (currentUser) {
				// Assert that currentUser is one of the 2 user in the current DM room
				if (currentDMRoom.user1_id != currentUser.id && currentDMRoom.user2_id != currentUser.id) {
					location.hash = '#messages';
					return (false);
				}
				// Assert currentUser have not been blocked by the other user
				if (otherUser && otherUser.blocked) {
					otherUser.blocked.forEach(block => {
						if (block.toward_id == currentUser.id) {
							location.hash = '#messages';
							return (false);
						}
					});
				}
			}
			
		}
		// console.log("directMessages end ====> ")
		// if (directMessages)
		// 	console.log(directMessages);
		this.$el.html(this.template({
			dmRooms: this.model,
			allUsers: this.allUsers.models,
			userID: this.user.id,
			//ADD
			chatID: this.chatID,
			currentUser: currentUser,
			otherUser: otherUser,
			currentDMRoom: currentDMRoom,
			directMessages: directMessages,
			token: $('meta[name="csrf-token"]').attr('content')
		}));
		return (this);
    }
    
	render() {
		this.model.fetch();
		this.delegateEvents();
		return (this);
    }

}
    