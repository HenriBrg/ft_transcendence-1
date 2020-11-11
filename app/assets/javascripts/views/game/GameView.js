AppClasses.Views.Game = class extends Backbone.View {
	constructor(opts) {
		super(opts);
		this.tagName = "div";
		this.template = App.templates["game/game"];
	}
	updateRender() {
		this.$el.html(this.template({ }));
		return (this);
	}
	render() {
		this.updateRender(); // generates HTML
		// the game has to be started in the router
		return (this);
	}
}
