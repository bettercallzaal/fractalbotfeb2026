import logging

def setup_logging(debug=False):
    """
    Configure and set up logging for the bot

    Args:
        debug (bool): Whether to use DEBUG level logging

    Returns:
        logger: Configured logger instance
    """
    log_level = logging.DEBUG if debug else logging.INFO

    # Configure root logger
    logging.basicConfig(
        level=log_level,
        format='[\033[92m%(asctime)s\033[0m] \033[94m%(levelname)s\033[0m: %(message)s',
        datefmt='%H:%M:%S'
    )

    # Get logger for the bot
    logger = logging.getLogger('bot')

    # Add console handler with colored output
    console = logging.StreamHandler()
    console.setFormatter(logging.Formatter(
        '[\033[92m%(asctime)s\033[0m] \033[94m%(levelname)s\033[0m: %(message)s',
        '%H:%M:%S'
    ))
    logger.addHandler(console)

    return logger
