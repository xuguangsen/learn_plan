package com.gotodo.app.mapper;

import com.gotodo.app.entity.UserState;
import java.util.Optional;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

/**
 * 用户状态表数据访问层。
 * 这个接口保留 MyBatis 注解写法，方便和 XML Mapper 版本对照学习。
 */
@Mapper
public interface UserStateMapper {
  @Select("""
    SELECT id, user_id, state_json, created_at, updated_at
    FROM user_state
    WHERE user_id = #{userId}
    LIMIT 1
    """)
  Optional<UserState> findByUserId(@Param("userId") Long userId);

  @Insert("""
    INSERT INTO user_state (user_id, state_json, created_at, updated_at)
    VALUES (#{userId}, #{stateJson}, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6))
    """)
  @Options(useGeneratedKeys = true, keyProperty = "id")
  int insert(UserState userState);

  /**
   * 当前项目把整份状态 JSON 作为一个字段保存。
   */
  @Update("""
    UPDATE user_state
    SET state_json = #{stateJson},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = #{id}
    """)
  int updateStateJson(@Param("id") Long id, @Param("stateJson") String stateJson);
}
