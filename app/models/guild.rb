class Guild < ApplicationRecord
	after_save do
		ActionCable.server.broadcast "update_channel", action: "update", target: "guilds"
	end
	after_destroy do
		ActionCable.server.broadcast "update_channel", action: "update", target: "guilds"
	end

	has_many :users, -> { where(guild_validated: true) }, class_name: "User"
	has_many :requests, -> { where(guild_validated: false) }, class_name: "User"
	has_one :owner, -> { where(guild_owner: true) }, class_name: "User"
	has_many :officers, -> { where(guild_officer: true) }, class_name: "User"

	has_many :g1_wars, :class_name => 'War', :foreign_key => 'guild1_id', dependent: :destroy
	has_many :g2_wars, :class_name => 'War', :foreign_key => 'guild2_id', dependent: :destroy
	def wars
		g1_wars + g2_wars
	end

	def active_war
		wars.each do |war|
			if war.winner == 0
				return war
			end
		end
		return nil
	end

	validates :name, uniqueness: true
	validates :anagram, uniqueness: true

	def self.clean(guild)
		newguild = {
			id: guild.id,
			name: guild.name,
			anagram: guild.anagram,
			points: guild.points,
			owner: User.strict_clean(guild.owner),
			users: guild.users.map { |usr| User.strict_clean(usr) },
			officers: guild.officers.map { |usr| User.strict_clean(usr) },
			requests: guild.requests.map { |usr| User.strict_clean(usr) },
			wars: guild.wars,
			active_war: War.clean(guild.active_war)
		}
	end

end
