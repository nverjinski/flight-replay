from flight_replay.replay.timing import delay_seconds

def test_delay_one_x():
    assert delay_seconds(0, 1000, speed=1) == 1.0

def test_delay_ten_x():
    assert delay_seconds(0, 1000, speed=10) == 0.1

def test_delay_hundred_x():
    assert delay_seconds(0, 1000, speed=100) == 0.01

def test_zero_or_backward_delta():
    assert delay_seconds(1000, 1000, speed=1) == 0.0
    assert delay_seconds(2000, 1000, speed=1) == 0.0