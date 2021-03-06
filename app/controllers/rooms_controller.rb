class RoomsController < ApplicationController
  before_action :connect_user
  before_action :reset_temporary_restrictions

  # GET /rooms
  # GET /rooms.json
  def index
    @rooms = Room.all.map do |rm|
      Room.cleanFetch(rm, current_user)
    end
  end

  # GET /rooms/1
  # GET /rooms/1.json
  def show
    puts params
  end

  # GET /rooms/new
  def new
    @room = Room.new
  end

  def joinPublic

    @room = Room.find(params["room"]["room_id"]) rescue nil
    if !@room 
      return res_with_error("Unknown Room", :bad_request)
    end

    if !current_user.rooms_as_member.include?(@room) && current_user.id != @room.owner_id
      @rlm = RoomLinkMember.new(room: @room, user: current_user)
      @rlm.save
    end

    respond_to do |format|
      ActionCable.server.broadcast "room_channel", type: "rooms", description: "join-public", user: current_user
      format.html { redirect_to rooms_url, notice: 'Room Joined !' }
      format.json { render json: {roomID: @room.id}, status: :ok }
    end
  end

  def joinPrivate
    @room = Room.find(params["room"]["room_id"]) rescue nil
    if !@room
      return res_with_error("Unknown Room", :bad_request)
    end
    # https://coderwall.com/p/sjegjq/use-bcrypt-for-passwords
    roomPass = BCrypt::Password.new(@room.password)
    if roomPass != params["room"]["password"]
      res_with_error("Wrong password !", :bad_request)
      return false
    end
    # The 'if' shouldn't be needed since the "Join" action is offer only 1 time, but by prevention we keep it
    if !current_user.rooms_as_member.include?(@room) && current_user.id != @room.owner_id
      @rlm = RoomLinkMember.new(room: @room, user: current_user)
      @rlm.save
    end

    respond_to do |format|
      ActionCable.server.broadcast "room_channel", type: "rooms", description: "join-private", user: current_user
      format.html { redirect_to rooms_url, notice: 'Room Joined !' }
      format.json { render json: {room: @room}, status: :ok }
    end
    
  end 

  def promoteAdmin
  
    filteredParams = params.require(:room).permit(:id, :member)
    @room = Room.find(filteredParams["id"]) rescue nil
    newAdmin = User.find(filteredParams["member"]) rescue nil
    if @room == nil || newAdmin == nil
      res_with_error("Room or Targeted User invalid", :bad_request)
      return false
    end
    if !RoomLinkAdmin.where(user_id: filteredParams["member"], room_id: filteredParams["id"]).exists?
      add = RoomLinkAdmin.new(room: @room, user: newAdmin)
      add.save
      RoomLinkMember.where(user_id: filteredParams["member"], room_id: filteredParams["id"]).destroy_all
      ActionCable.server.broadcast "room_channel", type: "rooms", description: "promote-admin", user: current_user
    end
    respond_to do |format|
      format.html { redirect_to @room, notice: 'Admin promoted' }
      format.json { render :show, status: :created, location: @room }
    end
  end

  def demoteAdmin
    filteredParams = params.require(:room).permit(:id, :member)
    @room = Room.find(filteredParams["id"]) rescue nil
    admin = User.find(filteredParams["member"]) rescue nil
    if @room == nil || admin == nil
      res_with_error("Room or Targeted User invalid", :bad_request)
      return false
    end
    if admin.rooms_as_admin.include?(@room) && admin.id != @room.owner_id
      add = RoomLinkMember.new(room: @room, user: admin)
      add.save
      RoomLinkAdmin.where(user_id: filteredParams["member"], room_id: filteredParams["id"]).destroy_all
      ActionCable.server.broadcast "room_channel", type: "rooms", description: "demote-admin", user: current_user
    end

    respond_to do |format|
      format.html { redirect_to @room, notice: 'Admin demoted' }
      format.json { render :show, status: :created, location: @room }
    end
  end


  def quit
    filteredParams = params.require(:room).permit(:room_id, :owner_id, :userRoomGrade)
    grade = filteredParams["userRoomGrade"]
    @room = Room.find(filteredParams["room_id"]) rescue nil

    if @room == nil
      res_with_error("Room nvalid", :bad_request)
      return false
    end

    if grade == "Owner" || grade == "Admin"
      RoomLinkAdmin.where(user: current_user, room: @room).destroy_all
    elsif grade == "Member"
      RoomLinkMember.where(user: current_user, room: @room).destroy_all
    else
      res_with_error("Unexpected Grade - Error", :bad_request)
      return false
    end

    RoomMessage.where(room: @room, user: current_user).destroy_all
    
    if grade == "Owner"
      @room.members.destroy_all
      @room.admins.destroy_all
      @room.room_messages.destroy_all
      RoomMute.where(room: @room).destroy_all
      RoomBan.where(room: @room).destroy_all
      @room.destroy
    end 
    respond_to do |format|
      ActionCable.server.broadcast "room_channel", type: "rooms", description: "quit", user: current_user
      format.html { redirect_to rooms_url, notice: 'You have leave the room'}
      format.json { head :no_content }
    end

  end

  # GET /rooms/1/edit
  def edit
  end

  # POST /rooms
  # POST /rooms.json
  def create
    
    filteredParams = params.require(:room).permit(:name, :owner_id, :privacy, :password)

    if filteredParams["privacy"] && filteredParams["privacy"] == "on"
      filteredParams["privacy"] = "private"
    else
      filteredParams["privacy"] = "public"
    end 

    if filteredParams["name"].empty?
      res_with_error("Invalid parameters", :bad_request)
      return (false)
    end
    if filteredParams["privacy"] == "private"
      if filteredParams["password"].empty?
        res_with_error("None empty password required if the room is private", :bad_request)
        return (false)
      else
        roomPassword = BCrypt::Password.create filteredParams["password"]
        filteredParams["password"] = roomPassword
      end
    end

    if !filteredParams["name"] || filteredParams["name"].length == 0 || filteredParams["name"].blank?
      res_with_error("Empty Room Name", :bad_request)
      return (false)
    elsif filteredParams["name"] && filteredParams["name"].length > 42
      res_with_error("Room name too long", :bad_request)
      return (false)
    end

    @room = Room.create(filteredParams)
    if @room && !current_user.rooms_as_admin.include?(@room)
      @rla = RoomLinkAdmin.new(room: @room, user: current_user)
      @rla.save
    end
  
    respond_to do |format|
      if @room.save
        ActionCable.server.broadcast "room_channel", type: "rooms", description: "create", user: current_user
        format.html { redirect_to @room, notice: 'Room was successfully created.' }
        format.json { render :show, status: :created, location: @room }
      else
        format.html { render :new }
        format.json { render json: {alert: "Name already taken"}, status: :unprocessable_entity }
      end
    end
  end

  # PATCH/PUT /rooms/1
  # PATCH/PUT /rooms/1.json
  def update

    filteredParams = params.require(:room).permit(:name, :privacy, :password, :id)
    @room = Room.find(filteredParams["id"]) rescue nil

    if filteredParams["privacy"] && filteredParams["privacy"] == "on"
      filteredParams["privacy"] = "private"
    else
      filteredParams["privacy"] = "public"
    end 

    # if !["", "public", "private"].include?(filteredParams["privacy"])
    #   res_with_error("Privacy field must be either empty, public or private", :bad_request)
    #   return (false)
    # end

    if filteredParams["privacy"] == "private"
      if filteredParams["password"].empty?
        res_with_error("None empty password required if the room is private", :bad_request)
        return (false)
      else
        roomPassword = BCrypt::Password.create filteredParams["password"]
        filteredParams["password"] = roomPassword
      end
    end

    if filteredParams["privacy"] == "public"
      filteredParams["password"] = ""
    end

    filteredParams.each do |key, value|
      if (value == "" && (filteredParams["privacy"] != "public" && key != "password"))
        filteredParams.delete(key)
      end
    end

    if !filteredParams["name"] || filteredParams["name"].length == 0 || filteredParams["name"].blank?
      res_with_error("Empty Room Name", :bad_request)
      return (false)
    end

    if @room == nil
      res_with_error("Unknown Room", :bad_request)
      return (false)
    end
    
    respond_to do |format|
      if @room.update(filteredParams)

        ActionCable.server.broadcast "room_channel", type: "rooms", description: "update", user: current_user
        format.html { redirect_to :index, notice: 'Room was successfully updated.' }
        format.json { render :index, status: :ok, location: @room }
      else
        format.html { render :edit }
        format.json { render json: @room, status: :unprocessable_entity }
      end
    end
  end

  # DELETE /rooms/1
  # DELETE /rooms/1.json
  def destroy
    filteredParams = params.require(:room).permit(:room_id)
    @room = Room.find(filteredParams["room_id"]) rescue nil
    if !@room
      res_with_error("Unknown room", :bad_request)
      return (false)
    end 
    @room.members.destroy_all
    @room.admins.destroy_all
    @room.room_messages.destroy_all
    RoomMute.where(room: @room).destroy_all
    RoomBan.where(room: @room).destroy_all
    @room.destroy
    respond_to do |format|
      ActionCable.server.broadcast "room_channel", type: "rooms", description: "Room Destroyed", user: current_user
      format.html { redirect_to :index, notice: 'Room was successfully destroyed.' }
      format.json { head :no_content }
    end
  end

  # POST /rooms/createDuelRequest
  # POST /rooms/createDuelRequest.json
  def createDuelRequest
    filteredParams = params.require(:duel_request).permit(:user_id, :room_id, :is_ranked)
    
    @room = Room.find(filteredParams["room_id"]) rescue nil
    return res_with_error("Room not found", :not_found) unless @room
    if @room && RoomMute.where(room: @room, user: current_user).exists?
      res_with_error("You're currently muted", :bad_request)
      return false
    end

    @duel_request = RoomMessage.create(message: "", user_id: filteredParams["user_id"], room_id: filteredParams["room_id"], is_duel_request: true, is_ranked: filteredParams["is_ranked"])
    respond_to do |format|
      if @duel_request.save
          ActionCable.server.broadcast "room_channel", type: "duel_request", description: "create-request", user: current_user
          format.html { redirect_to @duel_request, notice: 'Duel request was successfully created.' }
          format.json { head :no_content }
      else
          format.html { render :new }
          format.json { render json: @duel_request.errors, status: :unprocessable_entity }
      end
    end
  end

  # POST /rooms/acceptDuelRequest
  # POST /rooms/acceptDuelRequest.json
  def acceptDuelRequest
    filteredParams = params.require(:duel_request).permit(:room_id, :duel_id, :first_user_id, :second_user_id, :is_ranked)

    duel = Room.find(filteredParams["room_id"]).room_messages.find(filteredParams["duel_id"]) rescue nil

    if !duel || duel.is_duel_request == false
      return res_with_error("Unknown duel request", :bad_request)
    end 
    user1 = User.find(filteredParams["first_user_id"]) rescue nil
    user2 = User.find(filteredParams["second_user_id"]) rescue nil
    if !user1 || !user2
      return res_with_error("Unknown User(s)", :bad_request)
    end
    if user1.id != duel.user_id
      return res_with_error("Wrong user", :bad_request)
    end
    if duel.is_ranked && filteredParams["is_ranked"] == "false" || !duel.is_ranked && filteredParams["is_ranked"] == "true"
      return res_with_error("Wrong game type", :bad_request)
    end 
    Game.start(user1.email, user2.email,  if filteredParams["is_ranked"] == "true" then "duel_ranked" else "duel_unranked" end)
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_room
      @room = Room.find(params[:id]) rescue nil
      return res_with_error("Room not found", :not_found) unless @room
    end

    def res_with_info(msg)
      respond_to do |format|
        format.html { redirect_to "/", notice: "#{msg}" }
        format.json { render json: {msg: "#{msg}"}} #status: :ok
      end
    end

    def reset_temporary_restrictions
      if RoomMute.where('"endTime" < ?', DateTime.now).exists?
          RoomMute.where('"endTime" < ?', DateTime.now).destroy_all
          ActionCable.server.broadcast "room_channel", type: "rooms", description: "A user has reached the end of its muted period"
      end
      if RoomBan.where('"endTime" < ?', DateTime.now).exists?
          RoomBan.where('"endTime" < ?', DateTime.now).destroy_all
          ActionCable.server.broadcast "room_channel", type: "rooms", description: "A user has reached the end of its ban period"
      end 
  end

end
