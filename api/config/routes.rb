Rails.application.routes.draw do
  # Email preview (development only)
  mount LetterOpenerWeb::Engine, at: "/letter_opener" if Rails.env.development?

  # Devise — skip all default routes; we define our own API endpoints below
  devise_for :users, skip: :all

  namespace :api do
    namespace :v1 do
      # Auth
      post   "registrations",       to: "registrations#create"
      post   "sessions",            to: "sessions#create"
      delete "sessions",            to: "sessions#destroy"
      post   "passwords",           to: "passwords#create"
      patch  "passwords/:token",    to: "passwords#update"
      post   "auth/google",         to: "oauth#google"

      # Current user profile
      get   "me",                              to: "users#me"
      patch "me/subscription_tier",            to: "users#update_subscription_tier"
      patch "me/notification_preferences",     to: "users#update_notification_preferences"

      # Households + nested resources
      resources :households, only: [:index, :create, :show, :update] do
        resource  :membership,   only: [:show, :update]
        patch  'memberships/:id', to: 'memberships#manage_update'
        delete 'memberships/:id', to: 'memberships#manage_destroy'
        resources :cats, only: [:index, :create, :show, :update] do
          get :stats, on: :member
        end
        resources :care_events, only: [:index, :create, :update, :destroy]
        resources :care_notes,  only: [:index, :create, :update, :destroy]
        resources :reminders, only: [:index, :create, :update, :destroy] do
          member { post :test_send }
        end
        resources :batch_actions, only: [:index, :create, :update, :destroy],
                                  controller: 'household_batch_actions'
        resources :invites,     only: [:index, :create, :destroy], controller: 'household_invites'
      end

      # Token-based invite routes (show is public, accept requires auth)
      get  'invites/:token',        to: 'household_invites#show'
      post 'invites/:token/accept', to: 'household_invites#accept'

      # Super-admin endpoints
      namespace :admin do
        get  'stats',      to: 'stats#show'
        get  'users',      to: 'users#index'
        patch 'users/:id', to: 'users#update'
        post 'imports/care_events', to: 'imports#care_events'
      end
    end
  end

  get "up" => "rails/health#show", as: :rails_health_check
  get "health" => "health#show"
end
