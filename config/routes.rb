Rails.application.routes.draw do
 
  # home page
  root "home#index"

  scope "api" do
    # guild actions
    resources :guilds
    post '/guild/join', to: 'guilds#join'
    post '/guild/quit', to: 'guilds#quit'
    post '/guild/accept', to: 'guilds#accept_request'

    # CHAT ------
    resources :rooms do 
      resources :members, controller: 'room/members', only: [:index, :new, :create, :destroy]
      resources :admins, controller: 'room/admins',  only: [:index, :new, :create, :destroy]
    end 
    post '/rooms/join', to: 'rooms#join'
    post '/rooms/quit', to: 'rooms#quit'
    resources :room_messages
    # ------
    
    # friends actions
    post '/friends/add'
    post '/friends/accept'
    post '/friends/reject'
    post '/friends/destroy'
    post '/friends/get_all'
    # profile actions
    post 'profile/get'
  end



  # profile actions, I might move it to the API scope
  post '/profile/edit', to: 'profile#update'
  post '/profile/password', to: 'profile#change_password'
  post 'profile/enable_otp'
  post 'profile/disable_otp'

  # sign in route:
  devise_for :users, controllers: { omniauth_callbacks: "users/omniauth_callbacks" }

  # sign out route:
  devise_scope :user do
    delete 'sign_out', :to => 'devise/sessions#destroy', :as => :destroy_user_session_path
  end

  # For details on the DSL available within this file, see https://guides.rubyonrails.org/routing.html
end
