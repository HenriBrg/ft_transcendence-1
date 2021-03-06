AppClasses.Views.ShowRoom = class extends Backbone.View {
	constructor(opts) {
		opts.events = {
			"submit #sendRoomMessageForm": "submit",
			"submit #sendDuelRequest": "sendDuelRequest",
			"submit .AcceptDuelRequest": "AcceptDuelRequest",
		}
        super(opts);
		this.room_id = opts.room_id;
		this.user = opts.user;
		this.tagName = "div";
		this.template = App.templates["room/show"];
		this.guilds = App.collections.guilds;
		this.listenTo(this.guilds, "change reset add remove", this.updateRender);
		this.listenTo(this.model, "change add", this.updateRender);
		this.model.fetch();
		this.guilds.fetch();
		this.rooms = null;
		// For fetching blocked tables linked to user model
		App.models.user.update(App.models.user);
		this.updateRender();
	}
	
	AcceptDuelRequest(e)
	{
		e.preventDefault();
		if (!this.verif_accept_request(e)) return (false);
		var selectorFormID = "";
		if (e.currentTarget) selectorFormID = "#" + e.currentTarget.id;
		App.utils.formAjax("/api/rooms/acceptDuelRequest.json", selectorFormID)
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
		App.utils.formAjax("/api/rooms/createDuelRequest.json", "#sendDuelRequest")
		.done(res => {
			App.toast.success("Duel request sent !", { duration: 1500, style: App.toastStyle });
		})
		.fail((e) => {
			App.utils.toastError(e);
		});
		return (false);
	}

	submit(e) {
		e.preventDefault();
		if (!this.verif_infos(e)) return (false);
		if (!e.currentTarget.message || (e.currentTarget.message && e.currentTarget.message.value == ""))
			return ;
		App.utils.formAjax("/api/room_messages.json", "#sendRoomMessageForm")
		.done(res => {
			this.model.fetch();
			location.hash = `#rooms/` + this.room_id;
		})
		.fail((e) => {
			App.utils.toastError(e);
		});
		return (false);
	}

	verif_infos(e)
	{
		if (!e.currentTarget || !e.currentTarget[1] || !e.currentTarget[2] // verification null value
			|| e.currentTarget[1].value != this.user.id || e.currentTarget[2].value != this.room_id) // Verification value if not null
		{
			App.toast.alert("Something is wrong with this conversation");
			return (false);
		}
		return (true);
	}

	verif_accept_request(e)
	{
		if (!e.currentTarget || !e.currentTarget[1] || !e.currentTarget[2] || !e.currentTarget[3]
			|| !e.currentTarget[4] || !e.currentTarget[5] // verification null value
			|| e.currentTarget[1].value != this.room_id // Verification room's id
			|| e.currentTarget[4].value != this.user.id) // Verification user's id
		{
			App.toast.alert("Wrong duel request");
			return (false);
		}
		return (true);
	}

	updateRender() {

		var inspectMode = false;
		var guilds = null;
		const { attributes } = App.models.user;
		this.rooms = this.model;
		var currentRoom = this.rooms ? this.rooms.toJSON() : null;
		currentRoom = _.filter(currentRoom, m => {
			return m.id === this.room_id;
		})[0] || null;

		// Uri Protection : assert current user is member, or admin owner superAdmin, so if kicked, the user is redirect to index
		if (attributes && currentRoom && !App.utils.assertRoomCurrentUserIsMember(attributes, currentRoom)) {
			location.hash = '#room';
			return (false);
		}

		// Don't display blocked users messages to currentUser
		var tabBlockedUsersIDs = [];
		if (attributes.blocked) {
			attributes.blocked.forEach(block => {
				tabBlockedUsersIDs.push(block.toward_id);
			})
		}

		if (currentRoom) {
			var roomMessages = currentRoom.room_messages;
			if (this.guilds) guilds = this.guilds.toJSON();

			// Filter bans
			var members = [...currentRoom.members, ...currentRoom.admins];	
			currentRoom.bans.forEach(roomBanRecord => {
				if (currentRoom.owner_id != attributes.id && roomBanRecord.user_id == attributes.id) {
					location.hash = '#room';
					return (false);
				}
			});

			// Filter block user message
			roomMessages = roomMessages.filter(message => {
				return !tabBlockedUsersIDs.includes(message.user_id);
			})


			// This snippet have to handle the case when an user has been kick so that he doesn't stay on the chat page
			var idTab = [];
			currentRoom.members.forEach(user => {
				idTab.push(user.id);
			})
			currentRoom.admins.forEach(user => {
				idTab.push(user.id);
			})
			if (attributes && !attributes.admin && attributes.id != currentRoom.owner_id && !idTab.includes(attributes.id)) {
				location.hash = '#room';
				return false;
			}
			if (attributes) inspectMode = App.utils.assertRoomCurrentUserIsOnlySuperAdmin(attributes, currentRoom);

		}
		this.$el.html(this.template({
			currentRoom: currentRoom,
			roomMessages: roomMessages || null,
			currentUser: attributes,
			members: members || null,
			guilds: guilds,
			roomID: this.room_id,
			token: $('meta[name="csrf-token"]').attr('content'),
			// Form data for message creation
			messageCreateForm: {
				method: "POST",
				titleText: "Send a message",
				submitText: "Send",
				formID: "sendRoomMessageForm",
			},
			inspectMode: inspectMode
		}));
		this.delegateEvents();
		return (this);
    }
    
	render(room_id) {
		if (this.room_id != room_id) {
			this.room_id = room_id;
			this.updateRender();
		}
		this.model.fetch();
		this.delegateEvents();
		return (this);
    }
    
}
