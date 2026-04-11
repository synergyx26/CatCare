module Api
  module V1
    class PetExpensesController < BaseController
      before_action :set_household

      # GET /api/v1/households/:household_id/expenses
      def index
        authorize @household, policy_class: PetExpensePolicy
        return tier_error unless tier_feature_allowed?

        expenses = @household.pet_expenses
                             .includes(:cat, :created_by)
                             .for_cat(params[:cat_id])
                             .for_category(params[:category])
                             .order(purchase_date: :desc, created_at: :desc)
        expenses = apply_range_filter(expenses)

        render_success(expenses.map { |e| serialize_expense(e) })
      end

      # POST /api/v1/households/:household_id/expenses
      def create
        expense = @household.pet_expenses.build(expense_params)
        expense.created_by_id = current_user.id
        authorize expense
        return tier_error unless tier_feature_allowed?

        if expense.save
          render_success(serialize_expense(expense), status: :created)
        else
          render_error("VALIDATION_ERROR", expense.errors.full_messages.join(", "),
                       status: :unprocessable_entity)
        end
      end

      # PATCH /api/v1/households/:household_id/expenses/:id
      def update
        expense = @household.pet_expenses.find(params[:id])
        authorize expense
        return tier_error unless tier_feature_allowed?

        if expense.update(expense_params)
          render_success(serialize_expense(expense))
        else
          render_error("VALIDATION_ERROR", expense.errors.full_messages.join(", "),
                       status: :unprocessable_entity)
        end
      end

      # DELETE /api/v1/households/:household_id/expenses/:id
      def destroy
        expense = @household.pet_expenses.find(params[:id])
        authorize expense
        return tier_error unless tier_feature_allowed?
        expense.destroy
        render_success({ deleted: true })
      end

      # GET /api/v1/households/:household_id/expenses/stats
      def stats
        authorize @household, policy_class: PetExpensePolicy
        return tier_error unless tier_feature_allowed?

        start_date, end_date = date_range_for(params[:range] || "1m")
        expenses = @household.pet_expenses.for_range(start_date, end_date).to_a

        total       = expenses.sum(&:total_cost).round(2).to_f
        by_category = expenses.group_by(&:category)
                              .transform_values { |arr| arr.sum(&:total_cost).round(2).to_f }
        by_month    = expenses.group_by { |e| e.purchase_date.strftime("%Y-%m") }
                              .transform_values { |arr| arr.sum(&:total_cost).round(2).to_f }
                              .sort.to_h
        by_cat      = expenses.group_by { |e| e.cat_id.to_s }
                              .transform_values { |arr| arr.sum(&:total_cost).round(2).to_f }
        upcoming    = @household.pet_expenses.due_within(14).order(:purchase_date)
                                .map { |e| serialize_expense(e) }

        render_success({
          range:       params[:range] || "1m",
          start_date:  start_date,
          end_date:    end_date,
          total:       total,
          by_category: by_category,
          by_month:    by_month,
          by_cat:      by_cat,
          upcoming:    upcoming,
        })
      end

      private

      def set_household
        @household = current_household
      end

      def tier_feature_allowed?
        current_user.subscription_tier == "premium"
      end

      def tier_error
        render_error("TIER_LIMIT", "Expense tracking requires a Premium plan.",
                     status: :forbidden)
      end

      def date_range_for(range)
        end_date   = Date.today
        start_date = case range
                     when "1m"  then end_date - 1.month
                     when "3m"  then end_date - 3.months
                     when "6m"  then end_date - 6.months
                     when "1y"  then end_date - 1.year
                     when "all" then nil
                     else end_date - 1.month
                     end
        [ start_date, end_date ]
      end

      def apply_range_filter(expenses)
        # Explicit date range from list filter bar takes precedence over range pill
        if params[:date_from].present? || params[:date_to].present?
          return expenses.for_range(params[:date_from].presence, params[:date_to].presence)
        end
        return expenses unless params[:range].present?
        start_date, end_date = date_range_for(params[:range])
        expenses.for_range(start_date, end_date)
      end

      def expense_params
        params.require(:pet_expense).permit(
          :product_name, :brand, :category,
          :unit_price, :quantity, :unit_label,
          :purchase_date, :store_name, :store_url,
          :is_recurring, :recurrence_interval_days,
          :notes, :cat_id
        )
      end

      def serialize_expense(e)
        {
          id:                       e.id,
          household_id:             e.household_id,
          cat_id:                   e.cat_id,
          created_by_id:            e.created_by_id,
          product_name:             e.product_name,
          brand:                    e.brand,
          category:                 e.category,
          unit_price:               e.unit_price.to_f,
          quantity:                 e.quantity.to_f,
          unit_label:               e.unit_label,
          total_cost:               e.total_cost.to_f,
          purchase_date:            e.purchase_date,
          store_name:               e.store_name,
          store_url:                e.store_url,
          is_recurring:             e.is_recurring,
          recurrence_interval_days: e.recurrence_interval_days,
          notes:                    e.notes,
          created_at:               e.created_at,
        }
      end
    end
  end
end
