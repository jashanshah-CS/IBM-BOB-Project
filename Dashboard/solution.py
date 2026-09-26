# solution.py
# Sample target code used to demonstrate IBM Bob 2.0 automatic test generation

def process_user_reward(total_reward: float, num_users: int) -> list[float]:
    """
    Calculates equal reward splits among users.
    
    Potential Issues for IBM Bob 2.0 to catch:
    1. ZeroDivisionError if num_users is 0.
    2. Negative input handling for total_reward or num_users.
    3. Non-integer inputs for num_users.
    """
    if num_users == 0:
        # Intentional edge case: Should raise ValueError or return empty list
        raise ValueError("Users count cannot be zero")
    
    share = total_reward / num_users
    return [share] * num_users


def sanitize_username(username: str) -> str:
    """
    Trims whitespace and converts to lowercase.
    
    Potential Issues for IBM Bob 2.0 to catch:
    1. AttributeError if username is None.
    2. Stripping invalid characters.
    """
    if username is None:
        return ""
    
    return username.strip().lower()