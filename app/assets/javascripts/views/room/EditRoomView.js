AppClasses.Views.EditRoom = class extends Backbone.View {
	constructor(opts) {
		opts.events = {
			"submit #editRoomForm": "submit",
			"click #displayDeleteForm": "displayDeleteForm",
			"submit #deleteRoomForm": "delete",
			"click .form-check-input": "displayPasswordFieldEdit",

		}
		super(opts);
		this.room_id = opts.room_id;
		this.user = opts.user;
		this.tagName = "div";
		this.template = App.templates["room/edit"];
		this.listenTo(App.collections.rooms, "change reset add remove", this.updateRender);
		this.model.fetch();
		this.updateRender();

	}

	displayDeleteForm() {
		$("#deleteRoomForm").show()
	}

	displayPasswordFieldEdit() {
		$("#togglePasswordField").toggle();
	}

	submit(e) {
		e.preventDefault();
		App.utils.formAjax(`/api/rooms/${this.room_id}.json`, "#editRoomForm")
		.done(res => {
			App.toast.success("Room successfully created !", { duration: 2000, style: App.toastStyle });
			location.hash = `#room`;
		})
		.fail((e) => {
			App.utils.toastError(e);
		});
		return (false);
	}

	delete(e) {
		e.preventDefault();
		const room = this.model.findWhere({id: this.room_id});
		if (room && room.get("name") != $("#confirmRoomName")[0].value) {
			App.toast.message("Rooms names don't match", { duration: 2000, style: App.toastStyle });
			return ;
		}
		App.utils.formAjax(`/api/rooms/${this.room_id}.json`, "#deleteRoomForm")
		.done(res => {
			App.toast.success("Room successfully deleted", { duration: 2000, style: App.toastStyle });
			location.hash = `#room`;
		})
		.fail((e) => {
			App.utils.toastError(e);
		});
		return (false);
	}

	updateRender() {
		const u = App.models.user || null;
		const room = this.model.findWhere({id: this.room_id}) || null; 
		var name = null;
		if (room) name = room.attributes.name || null;
		if (u && room && !App.utils.assertRoomCurrentUserIsOwnerOrSuperAdmin(u.attributes, room.attributes)) {
			location.hash = '#room';
			return (false);
		}
		/* Give Data to the room form template */
		this.$el.html(this.template({ 
			user: u,
			titleText: "Edit Room",
			EditText: "Edit the room",
			editID: "editRoomForm",
			DeleteButton: "displayDeleteForm",
			DeleteText: "Delete the room",
			deleteID: "deleteRoomForm",
			room_id: this.room_id,
			room: room,
			name: name,
			token: $('meta[name="csrf-token"]').attr('content')
		}));
		/* Tell BB to remove after submit */
		this.delegateEvents();
		return (this);
	}
	render(room_id) {
		if (this.room_id != room_id) {
			this.room_id = room_id;
			this.updateRender();
		}
		this.updateRender();
		return (this);
	}
}
